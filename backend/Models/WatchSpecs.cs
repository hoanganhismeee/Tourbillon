// Standardized watch specifications model
// Fields chosen based on what's consistently available across all luxury watch brand websites
// Any field not available for a brand will be null (displayed as "N/A" in frontend)

using System.Text.Json.Serialization;

namespace backend.Models;

/// Dial specifications - what you see on the watch face
public class DialSpecs
{
    /// Dial color (e.g., "Blue", "Silver", "Black")
    [JsonPropertyName("color")]
    public string? Color { get; set; }

    /// Surface finish (e.g., "Sunburst", "Galvanic", "Lacquered", "Guilloché")
    [JsonPropertyName("finish")]
    public string? Finish { get; set; }

    /// Hour marker type (e.g., "Applied baton", "Roman numerals", "Arabic numerals")
    [JsonPropertyName("indices")]
    public string? Indices { get; set; }

    /// Hands style (e.g., "Dauphine", "Baton", "Leaf", "Luminous")
    [JsonPropertyName("hands")]
    public string? Hands { get; set; }
}

/// Case specifications - the watch body
public class CaseSpecs
{
    /// Case material (e.g., "Stainless steel", "18K rose gold", "Platinum")
    [JsonPropertyName("material")]
    public string? Material { get; set; }

    /// Case diameter (e.g., "40 mm", "42.5 mm")
    [JsonPropertyName("diameter")]
    public string? Diameter { get; set; }

    /// Case thickness (e.g., "9.24 mm", "11.5 mm")
    [JsonPropertyName("thickness")]
    public string? Thickness { get; set; }

    /// Water resistance (e.g., "30 m / 3 bar", "100 m / 10 bar")
    [JsonPropertyName("waterResistance")]
    public string? WaterResistance { get; set; }

    /// Crystal type (e.g., "Sapphire", "Sapphire with anti-reflective coating")
    [JsonPropertyName("crystal")]
    public string? Crystal { get; set; }

    /// Case back type (e.g., "Transparent", "Solid", "Sapphire crystal")
    [JsonPropertyName("caseBack")]
    public string? CaseBack { get; set; }
}

/// Movement specifications - the engine
public class MovementSpecs
{
    /// Caliber name (e.g., "Calibre 36-01", "26-330 S C", "3255")
    [JsonPropertyName("caliber")]
    public string? Caliber { get; set; }

    /// Movement type: "Automatic", "Manual", or "Quartz"
    [JsonPropertyName("type")]
    public string? Type { get; set; }

    /// Power reserve (e.g., "70 hours", "min. 35 - max. 45 hours")
    [JsonPropertyName("powerReserve")]
    public string? PowerReserve { get; set; }

    /// Frequency (e.g., "28,800 vph (4 Hz)", "21,600 vph (3 Hz)")
    [JsonPropertyName("frequency")]
    public string? Frequency { get; set; }

    /// Number of jewels (e.g., 30, 38)
    [JsonPropertyName("jewels")]
    public int? Jewels { get; set; }

    /// Watch functions/complications (e.g., ["Hours", "Minutes", "Date", "Moon phase"])
    [JsonPropertyName("functions")]
    public List<string>? Functions { get; set; }
}

/// Strap/Bracelet specifications
public class StrapSpecs
{
    /// Strap or bracelet material (e.g., "Alligator leather", "Stainless steel bracelet")
    [JsonPropertyName("material")]
    public string? Material { get; set; }

    /// Strap color (e.g., "Black", "Brown", "Blue")
    [JsonPropertyName("color")]
    public string? Color { get; set; }

    /// Buckle/clasp type (e.g., "Fold clasp", "Pin buckle", "Deployant clasp")
    [JsonPropertyName("buckle")]
    public string? Buckle { get; set; }
}

/// Complete watch specifications - stored as JSON in Watch.Specs
public class WatchSpecs
{
    /// Production status (e.g., "Current production", "Discontinued")
    [JsonPropertyName("productionStatus")]
    public string? ProductionStatus { get; set; }

    [JsonPropertyName("dial")]
    public DialSpecs? Dial { get; set; }

    [JsonPropertyName("case")]
    public CaseSpecs? Case { get; set; }

    [JsonPropertyName("movement")]
    public MovementSpecs? Movement { get; set; }

    [JsonPropertyName("strap")]
    public StrapSpecs? Strap { get; set; }
}
