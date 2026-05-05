// Shared HTML shell and OTP "pill" styling for customer-facing Tourbillon emails.
// Matches the table layout, header, and footer used in AppointmentService and RegisterInterestService.
using System.Net;

namespace backend.Services;

public static class TransactionalEmailLayout
{
    /// <summary>Spaced characters for on-screen readability (e.g. "A B C 1 2 3").</summary>
    public static string FormatCodeForDisplay(string code) =>
        string.Join(" ", code.ToCharArray().Select(c => WebUtility.HtmlEncode(c.ToString())));

    /// <summary>Centered gold pill matching site primary CTAs (#bfa68a, dark text).</summary>
    public static string CodePillRow(string code)
    {
        var display = FormatCodeForDisplay(code);
        return $@"
                <tr><td style=""padding:0 40px 28px;"" align=""center"">
                    <table cellpadding=""0"" cellspacing=""0"" role=""presentation"" style=""margin:0 auto;"">
                        <tr>
                            <td align=""center"" style=""background-color:#bfa68a;border-radius:999px;padding:16px 40px;"">
                                <span style=""font-family:'Helvetica Neue',Arial,sans-serif;font-size:22px;font-weight:600;color:#1a1613;"">{display}</span>
                            </td>
                        </tr>
                    </table>
                </td></tr>";
    }

    /// <param name="documentTitle">HTML document title (browser / client preview).</param>
    /// <param name="innerTableRows">Raw <c>&lt;tr&gt;...&lt;/tr&gt;</c> markup between header and footer bands.</param>
    public static string BuildCustomerEmail(string documentTitle, string innerTableRows)
    {
        return $@"
<!DOCTYPE html>
<html>
<head>
    <meta charset=""utf-8"">
    <meta name=""viewport"" content=""width=device-width, initial-scale=1.0"">
    <title>{WebUtility.HtmlEncode(documentTitle)}</title>
</head>
<body style=""margin:0;padding:0;background-color:#f5f0eb;font-family:'Helvetica Neue',Arial,sans-serif;"">
    <table width=""100%"" cellpadding=""0"" cellspacing=""0"" style=""background-color:#f5f0eb;padding:40px 20px;"">
        <tr><td align=""center"">
            <table width=""600"" cellpadding=""0"" cellspacing=""0"" style=""max-width:600px;background:#ffffff;border-radius:8px;overflow:hidden;"">
                <tr><td style=""background-color:#1a1613;padding:32px 40px;text-align:center;"">
                    <h1 style=""margin:0;color:#ecddc8;font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:normal;letter-spacing:2px;"">TOURBILLON</h1>
                </td></tr>
{innerTableRows}
                <tr><td style=""background-color:#1a1613;padding:24px 40px;text-align:center;"">
                    <p style=""margin:0 0 8px;color:#ecddc8;font-family:Georgia,'Times New Roman',serif;font-size:16px;letter-spacing:1px;"">TOURBILLON</p>
                    <p style=""margin:0;color:#8a7a66;font-size:12px;"">123 George Street, Sydney NSW 2000</p>
                    <p style=""margin:4px 0 0;color:#8a7a66;font-size:12px;"">Mon - Sat: 10:00 AM - 6:00 PM</p>
                </td></tr>
            </table>
        </td></tr>
    </table>
</body>
</html>";
    }
}
