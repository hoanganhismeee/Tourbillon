// Structured watch specifications model
// Based on Patek Philippe's comprehensive specifications format
// Other brands can leave fields null if not available

using System.Text.Json.Serialization;

namespace backend.Models;

/// <summary>
/// Dial specifications
/// </summary>
public class DialSpecs
{
    /// <summary>
    /// Full description of the dial
    /// Example: "Lacquered black, white gold applied faceted trapeze-style hour markers"
    /// </summary>
    [JsonPropertyName("description")]
    public string? Description { get; set; }

    /// <summary>
    /// Dial color
    /// Example: "Black", "White", "Blue sunburst"
    /// </summary>
    [JsonPropertyName("color")]
    public string? Color { get; set; }

    /// <summary>
    /// Hour markers type
    /// Example: "White gold faceted trapeze-style", "Applied baton indices"
    /// </summary>
    [JsonPropertyName("markers")]
    public string? Markers { get; set; }

    /// <summary>
    /// Hands style
    /// Example: "White gold faceted dauphine-style", "Luminous baton hands"
    /// </summary>
    [JsonPropertyName("hands")]
    public string? Hands { get; set; }
}

/// <summary>
/// Case specifications
/// </summary>
public class CaseSpecs
{
    /// <summary>
    /// Case material
    /// Example: "White gold", "Platinum", "Stainless steel"
    /// </summary>
    [JsonPropertyName("material")]
    public string? Material { get; set; }

    /// <summary>
    /// Case diameter
    /// Example: "39 mm", "40mm", "42.5 mm"
    /// </summary>
    [JsonPropertyName("diameter")]
    public string? Diameter { get; set; }

    /// <summary>
    /// Case thickness
    /// Example: "9.24 mm", "11.5mm"
    /// </summary>
    [JsonPropertyName("thickness")]
    public string? Thickness { get; set; }

    /// <summary>
    /// Water resistance
    /// Example: "30m", "100 meters", "50 ATM"
    /// </summary>
    [JsonPropertyName("waterResistance")]
    public string? WaterResistance { get; set; }

    /// <summary>
    /// Crystal type
    /// Example: "Sapphire", "Sapphire with anti-reflective coating"
    /// </summary>
    [JsonPropertyName("crystal")]
    public string? Crystal { get; set; }

    /// <summary>
    /// Case back description
    /// Example: "Sapphire crystal case back", "Solid case back with engraving"
    /// </summary>
    [JsonPropertyName("caseBack")]
    public string? CaseBack { get; set; }
}

/// <summary>
/// Strap/Bracelet specifications
/// </summary>
public class StrapSpecs
{
    /// <summary>
    /// Strap or bracelet material
    /// Example: "Alligator leather with square scales", "Stainless steel bracelet"
    /// </summary>
    [JsonPropertyName("material")]
    public string? Material { get; set; }

    /// <summary>
    /// Strap color
    /// Example: "Shiny black", "Brown", "Navy blue"
    /// </summary>
    [JsonPropertyName("color")]
    public string? Color { get; set; }

    /// <summary>
    /// Buckle or clasp material and type
    /// Example: "White gold prong buckle", "Folding clasp with double push-buttons"
    /// </summary>
    [JsonPropertyName("buckle")]
    public string? Buckle { get; set; }
}

/// <summary>
/// Movement specifications
/// </summary>
public class MovementSpecs
{
    /// <summary>
    /// Movement caliber/reference number
    /// Example: "26-330 S C", "Calibre 3255", "1120 QP"
    /// </summary>
    [JsonPropertyName("caliber")]
    public string? Caliber { get; set; }

    /// <summary>
    /// Movement type
    /// Example: "Self-winding", "Automatic", "Manual winding", "Quartz"
    /// </summary>
    [JsonPropertyName("type")]
    public string? Type { get; set; }

    /// <summary>
    /// List of complications
    /// Example: ["Date in an aperture", "Sweep seconds"], ["Chronograph", "Annual calendar"]
    /// </summary>
    [JsonPropertyName("complications")]
    public List<string>? Complications { get; set; }

    /// <summary>
    /// Movement diameter
    /// Example: "27 mm", "30.0mm"
    /// </summary>
    [JsonPropertyName("diameter")]
    public string? Diameter { get; set; }

    /// <summary>
    /// Movement thickness
    /// Example: "3.32 mm", "5.5mm"
    /// </summary>
    [JsonPropertyName("thickness")]
    public string? Thickness { get; set; }

    /// <summary>
    /// Number of parts/components
    /// Example: 212, 354
    /// </summary>
    [JsonPropertyName("parts")]
    public int? Parts { get; set; }

    /// <summary>
    /// Number of jewels
    /// Example: 30, 38
    /// </summary>
    [JsonPropertyName("jewels")]
    public int? Jewels { get; set; }

    /// <summary>
    /// Power reserve duration
    /// Example: "min. 35 hours – max. 45 hours", "70 hours", "48h"
    /// </summary>
    [JsonPropertyName("powerReserve")]
    public string? PowerReserve { get; set; }

    /// <summary>
    /// Rotor description
    /// Example: "21K gold central rotor", "Platinum micro-rotor"
    /// </summary>
    [JsonPropertyName("rotor")]
    public string? Rotor { get; set; }

    /// <summary>
    /// Frequency (vibrations per hour)
    /// Example: "28,800 semi-oscillations/hour (4 Hz)", "21,600 vph (3 Hz)"
    /// </summary>
    [JsonPropertyName("frequency")]
    public string? Frequency { get; set; }

    /// <summary>
    /// Balance spring type
    /// Example: "Spiromax®", "Parachrom hairspring", "Silicon balance spring"
    /// </summary>
    [JsonPropertyName("balanceSpring")]
    public string? BalanceSpring { get; set; }

    /// <summary>
    /// Distinctive hallmark or seal
    /// Example: "Patek Philippe Seal", "Poinçon de Genève", "Hallmark of Geneva"
    /// </summary>
    [JsonPropertyName("hallmark")]
    public string? Hallmark { get; set; }
}

/// <summary>
/// Complete watch specifications
/// Stores as JSON string in Watch.Specs field
/// </summary>
public class WatchSpecs
{
    /// <summary>
    /// Dial specifications
    /// </summary>
    [JsonPropertyName("dial")]
    public DialSpecs? Dial { get; set; }

    /// <summary>
    /// Case specifications
    /// </summary>
    [JsonPropertyName("case")]
    public CaseSpecs? Case { get; set; }

    /// <summary>
    /// Strap/Bracelet specifications
    /// </summary>
    [JsonPropertyName("strap")]
    public StrapSpecs? Strap { get; set; }

    /// <summary>
    /// Movement specifications
    /// </summary>
    [JsonPropertyName("movement")]
    public MovementSpecs? Movement { get; set; }
}
