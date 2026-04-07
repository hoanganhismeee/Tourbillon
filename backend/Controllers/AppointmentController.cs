// Handles appointment bookings — supports both authenticated and guest users.
using backend.Extensions;
using backend.Models;
using backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AppointmentController : ControllerBase
{
    private readonly IAppointmentService _appointmentService;

    public AppointmentController(IAppointmentService appointmentService)
    {
        _appointmentService = appointmentService;
    }

    // GET /api/appointment/my-appointments — list the current user's appointments
    [HttpGet("my-appointments")]
    [Authorize]
    public async Task<IActionResult> GetMyAppointments()
    {
        var userId = User.GetUserId();
        if (userId == null) return Unauthorized();

        var appointments = await _appointmentService.GetByUserIdAsync(userId.Value);
        return Ok(appointments.Select(a => new
        {
            a.Id,
            a.BoutiqueName,
            a.VisitPurpose,
            a.AppointmentDate,
            a.BrandName,
            a.Status,
            a.CreatedAt
        }));
    }

    // POST /api/appointment/book — book an in-store appointment
    [HttpPost("book")]
    public async Task<IActionResult> BookAppointment([FromBody] CreateAppointmentDto dto)
    {
        var userId = User.GetUserId();

        try
        {
            var appointment = await _appointmentService.BookAppointmentAsync(userId, dto);
            return Ok(new AppointmentResponseDto
            {
                Id = appointment.Id,
                AppointmentDate = appointment.AppointmentDate,
                Status = appointment.Status,
                CreatedAt = appointment.CreatedAt
            });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

}
