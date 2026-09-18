// Wall-clock time per pipeline stage for one request, reported in the standard Server-Timing header.
// The collector travels in an AsyncLocal, so a stage deep in the call chain records itself without a
// constructor parameter, and stages that run in parallel each keep their own duration.
using System.Collections.Concurrent;
using System.Diagnostics;
using System.Globalization;

namespace backend.Infrastructure;

public sealed class StageTimings
{
    private static readonly AsyncLocal<StageTimings?> CurrentTimings = new();

    private readonly ConcurrentDictionary<string, StageTotal> _stages = new(StringComparer.Ordinal);
    private readonly long _started = Stopwatch.GetTimestamp();

    public readonly record struct StageTotal(double Milliseconds, int Count);

    // Starts a collector for the current async flow; every stage awaited below this point records into it.
    // Outside a request that called Begin (background jobs, tests) the static helpers do nothing.
    public static StageTimings Begin()
    {
        var timings = new StageTimings();
        CurrentTimings.Value = timings;
        return timings;
    }

    // The collector is captured when the stage starts, so a stage that outlives its caller's await
    // (a prefetch nobody ended up needing) still lands in the request that started it.
    public static async Task<T> TimeAsync<T>(string stage, Func<Task<T>> work)
    {
        var timings = CurrentTimings.Value;
        var started = Stopwatch.GetTimestamp();
        try
        {
            return await work();
        }
        finally
        {
            timings?.Record(stage, Stopwatch.GetElapsedTime(started).TotalMilliseconds);
        }
    }

    public void Record(string stage, double milliseconds) =>
        _stages.AddOrUpdate(
            stage,
            new StageTotal(milliseconds, 1),
            (_, existing) => new StageTotal(existing.Milliseconds + milliseconds, existing.Count + 1));

    public IReadOnlyDictionary<string, StageTotal> Snapshot() => new Dictionary<string, StageTotal>(_stages);

    // "classify;dur=812.4;desc="2 calls", parse;dur=903.1, total;dur=5120.0". A stage that ran more
    // than once reports its summed time and the call count, which is how a repeated call shows up.
    public string ToServerTimingHeader()
    {
        var entries = _stages
            .OrderBy(pair => pair.Key, StringComparer.Ordinal)
            .Select(pair => pair.Value.Count > 1
                ? $"{pair.Key};dur={Format(pair.Value.Milliseconds)};desc=\"{pair.Value.Count} calls\""
                : $"{pair.Key};dur={Format(pair.Value.Milliseconds)}")
            .Append($"total;dur={Format(Stopwatch.GetElapsedTime(_started).TotalMilliseconds)}");
        return string.Join(", ", entries);
    }

    private static string Format(double milliseconds) =>
        milliseconds.ToString("0.0", CultureInfo.InvariantCulture);
}
