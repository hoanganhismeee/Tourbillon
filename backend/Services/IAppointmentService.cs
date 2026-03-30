// Appointment booking — saves to DB, sends confirmation + admin notification emails
using backend.Models;

namespace backend.Services;

public interface IAppointmentService
{
    Task<Appointment> BookAppointmentAsync(int? userId, CreateAppointmentDto dto);
    Task<List<Appointment>> GetByUserIdAsync(int userId);
}
