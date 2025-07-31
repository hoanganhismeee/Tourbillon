// This middleware sanitizes sensitive data from request logs to ensure passwords remain anonymous
// It automatically redacts password fields from logs while preserving request structure
// and only processes password-related endpoints for efficiency.
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using System.Text;

namespace backend.Middleware;

// Sanitizes sensitive data from request logs to ensure passwords remain anonymous
// by automatically redacting password fields and preserving request structure.
public class RequestSanitizationMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<RequestSanitizationMiddleware> _logger;

    public RequestSanitizationMiddleware(RequestDelegate next, ILogger<RequestSanitizationMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    // Processes requests and sanitizes sensitive data from password-related endpoints
    public async Task InvokeAsync(HttpContext context)
    {
        // Only sanitize password-related endpoints
        if (IsPasswordRelatedEndpoint(context.Request.Path))
        {
            await LogSanitizedRequest(context);
        }

        await _next(context);
    }

    // Determines if the request path is related to password operations
    private bool IsPasswordRelatedEndpoint(PathString path)
    {
        var pathString = path.Value?.ToLower();
        return pathString != null && (
            pathString.Contains("/account/update") ||
            pathString.Contains("/account/login") ||
            pathString.Contains("/account/register")
        );
    }

    // Logs the request with sanitized body content (passwords redacted)
    private async Task LogSanitizedRequest(HttpContext context)
    {
        try
        {
            var requestBody = await GetSanitizedRequestBody(context.Request);
            
            _logger.LogInformation(
                "Request: {Method} {Path} - Body: {SanitizedBody}",
                context.Request.Method,
                context.Request.Path,
                requestBody
            );
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to sanitize request body for logging");
        }
    }

    // Reads and sanitizes the request body by redacting password fields
    private async Task<string> GetSanitizedRequestBody(HttpRequest request)
    {
        if (request.Body == null || !request.Body.CanRead)
            return "[No body]";

        // Store original position
        var originalPosition = request.Body.Position;
        
        try
        {
            // Reset position to beginning
            request.Body.Position = 0;
            
            using var reader = new StreamReader(request.Body, Encoding.UTF8, leaveOpen: true);
            var body = await reader.ReadToEndAsync();
            
            // Sanitize sensitive fields
            var sanitizedBody = SanitizeSensitiveData(body);
            
            return sanitizedBody;
        }
        finally
        {
            // Restore original position
            request.Body.Position = originalPosition;
        }
    }

    // Replaces password fields in JSON with [REDACTED] to ensure anonymity
    private string SanitizeSensitiveData(string jsonBody)
    {
        if (string.IsNullOrEmpty(jsonBody))
            return "[Empty body]";

        try
        {
            // Simple JSON sanitization - replace password fields with [REDACTED]
            var sanitized = jsonBody;
            
            // Replace password fields with [REDACTED]
            sanitized = System.Text.RegularExpressions.Regex.Replace(
                sanitized, 
                @"""currentPassword""\s*:\s*""[^""]*""", 
                @"""currentPassword"": ""[REDACTED]"""
            );
            
            sanitized = System.Text.RegularExpressions.Regex.Replace(
                sanitized, 
                @"""newPassword""\s*:\s*""[^""]*""", 
                @"""newPassword"": ""[REDACTED]"""
            );
            
            sanitized = System.Text.RegularExpressions.Regex.Replace(
                sanitized, 
                @"""password""\s*:\s*""[^""]*""", 
                @"""password"": ""[REDACTED]"""
            );
            
            return sanitized;
        }
        catch
        {
            return "[Failed to sanitize body]";
        }
    }
} 