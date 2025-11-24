// Structured watch specifications model
// Based on Patek Philippe's comprehensive specifications format
// Other brands can leave fields null if not available

using System.Text.Json.Serialization;

namespace backend.Models;

/// Dial specifications
public class DialSpecs
{
    /// Full description of the dial
    /// Example: "Lacquered black, white gold applied faceted trapeze-style hour markers"
    [JsonPropertyName("description")]
    public string? Description { get; set; }

    /// Dial color
    /// Example: "Black", "White", "Blue sunburst"
    [JsonPropertyName("color")]
    public string? Color { get; set; }

    /// Hour markers type
    /// Example: "White gold faceted trapeze-style", "Applied baton indices"
    [JsonPropertyName("markers")]
    public string? Markers { get; set; }

    /// Hands style
    /// Example: "White gold faceted dauphine-style", "Luminous baton hands"
    [JsonPropertyName("hands")]
    public string? Hands { get; set; }
}

/// Case specifications
public class CaseSpecs
{
    /// Case material
    /// Example: "White gold", "Platinum", "Stainless steel"
    [JsonPropertyName("material")]
    public string? Material { get; set; }

    /// Case diameter
    /// Example: "39 mm", "40mm", "42.5 mm"
    [JsonPropertyName("diameter")]
    public string? Diameter { get; set; }

    /// Case thickness
    /// Example: "9.24 mm", "11.5mm"
    [JsonPropertyName("thickness")]
    public string? Thickness { get; set; }

    /// Water resistance
    /// Example: "30m", "100 meters", "50 ATM"
    [JsonPropertyName("waterResistance")]
    public string? WaterResistance { get; set; }

    /// Crystal type
    /// Example: "Sapphire", "Sapphire with anti-reflective coating"
    [JsonPropertyName("crystal")]
    public string? Crystal { get; set; }

    /// Case back description
    /// Example: "Sapphire crystal case back", "Solid case back with engraving"
    [JsonPropertyName("caseBack")]
    public string? CaseBack { get; set; }
}

/// Strap/Bracelet specifications
public class StrapSpecs
{
    /// Strap or bracelet material
    /// Example: "Alligator leather with square scales", "Stainless steel bracelet"
    [JsonPropertyName("material")]
    public string? Material { get; set; }

    /// Strap color
    /// Example: "Shiny black", "Brown", "Navy blue"
    [JsonPropertyName("color")]
    public string? Color { get; set; }

    /// Buckle or clasp material and type
    /// Example: "White gold prong buckle", "Folding clasp with double push-buttons"
    [JsonPropertyName("buckle")]
    public string? Buckle { get; set; }
}

/// Movement specifications
public class MovementSpecs
{
    /// Movement caliber/reference number
    /// Example: "26-330 S C", "Calibre 3255", "1120 QP"
    [JsonPropertyName("caliber")]
    public string? Caliber { get; set; }

    /// Movement type
    /// Example: "Self-winding", "Automatic", "Manual winding", "Quartz"
    [JsonPropertyName("type")]
    public string? Type { get; set; }

    /// List of complications
    /// Example: ["Date in an aperture", "Sweep seconds"], ["Chronograph", "Annual calendar"]
    [JsonPropertyName("complications")]
    public List<string>? Complications { get; set; }

    /// Movement diameter
    /// Example: "27 mm", "30.0mm"
    [JsonPropertyName("diameter")]
    public string? Diameter { get; set; }

    /// Movement thickness
    /// Example: "3.32 mm", "5.5mm"
    [JsonPropertyName("thickness")]
    public string? Thickness { get; set; }

    /// Number of parts/components
    /// Example: 212, 354
    [JsonPropertyName("parts")]
    public int? Parts { get; set; }

    /// Number of jewels
    /// Example: 30, 38
    [JsonPropertyName("jewels")]
    public int? Jewels { get; set; }

    /// Power reserve duration
    /// Example: "min. 35 hours – max. 45 hours", "70 hours", "48h"
    [JsonPropertyName("powerReserve")]
    public string? PowerReserve { get; set; }

    /// Rotor description
    /// Example: "21K gold central rotor", "Platinum micro-rotor"
    [JsonPropertyName("rotor")]
    public string? Rotor { get; set; }

    /// Frequency (vibrations per hour)
    /// Example: "28,800 semi-oscillations/hour (4 Hz)", "21,600 vph (3 Hz)"
    [JsonPropertyName("frequency")]
    public string? Frequency { get; set; }

    /// Balance spring type
    /// Example: "Spiromax®", "Parachrom hairspring", "Silicon balance spring"
    [JsonPropertyName("balanceSpring")]
    public string? BalanceSpring { get; set; }

    /// Distinctive hallmark or seal
    /// Example: "Patek Philippe Seal", "Poinçon de Genève", "Hallmark of Geneva"
    [JsonPropertyName("hallmark")]
    public string? Hallmark { get; set; }
}

/// Complete watch specifications
/// Stores as JSON string in Watch.Specs field
public class WatchSpecs
{
    /// Dial specifications
    [JsonPropertyName("dial")]
    public DialSpecs? Dial { get; set; }

    /// Case specifications
    [JsonPropertyName("case")]
    public CaseSpecs? Case { get; set; }

    /// Strap/Bracelet specifications
    [JsonPropertyName("strap")]
    public StrapSpecs? Strap { get; set; }

    /// Movement specifications
    [JsonPropertyName("movement")]
    public MovementSpecs? Movement { get; set; }

    /// Additional brand-specific specifications
    /// Captures extra details that don't fit standard categories (e.g. VC's "Recto/Verso" details)
    [JsonPropertyName("additional")]
    public Dictionary<string, string>? Additional { get; set; }
}
