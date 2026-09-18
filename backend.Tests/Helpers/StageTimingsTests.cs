// Tests for per-request stage timing. These numbers decide which model call to cut next, so a stage
// that silently fails to record, or records into the wrong request, would point that work the wrong way.
using backend.Infrastructure;

namespace backend.Tests.Helpers;

public class StageTimingsTests
{
    [Fact]
    public async Task RepeatedStageIsSummedAndCounted()
    {
        var timings = StageTimings.Begin();

        await StageTimings.TimeAsync("classify", () => Task.FromResult(1));
        await StageTimings.TimeAsync("classify", () => Task.FromResult(2));
        await StageTimings.TimeAsync("parse", () => Task.FromResult(3));

        var stages = timings.Snapshot();
        Assert.Equal(2, stages["classify"].Count);
        Assert.Equal(1, stages["parse"].Count);
        var header = timings.ToServerTimingHeader();
        Assert.Contains("classify;dur=", header);
        Assert.Contains("desc=\"2 calls\"", header);
        Assert.Matches(@"total;dur=\d+\.\d$", header);
    }

    [Fact]
    public async Task StagesRunInParallelEachRecordTheirOwnTime()
    {
        var timings = StageTimings.Begin();

        await Task.WhenAll(
            StageTimings.TimeAsync("chat", async () => { await Task.Delay(40); return 0; }),
            StageTimings.TimeAsync("planner", async () => { await Task.Delay(40); return 0; }));

        var stages = timings.Snapshot();
        Assert.True(stages["chat"].Milliseconds >= 30);
        Assert.True(stages["planner"].Milliseconds >= 30);
    }

    [Fact]
    public async Task StageThatOutlivesItsCallerStillLandsInItsOwnRequest()
    {
        var first = StageTimings.Begin();
        var pending = StageTimings.TimeAsync("parse", async () => { await Task.Delay(30); return 0; });

        var second = StageTimings.Begin();
        await pending;

        Assert.True(first.Snapshot().ContainsKey("parse"));
        Assert.False(second.Snapshot().ContainsKey("parse"));
    }

    [Fact]
    public async Task WithoutACollectorTheWorkStillRuns()
    {
        var value = await Task.Run(() => StageTimings.TimeAsync("embed", () => Task.FromResult(42)));

        Assert.Equal(42, value);
    }
}
