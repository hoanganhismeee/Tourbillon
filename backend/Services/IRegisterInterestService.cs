// Service interface for Register Your Interest submissions
using backend.Models;

namespace backend.Services;

public interface IRegisterInterestService
{
    Task<RegisterInterest> RegisterAsync(int? userId, CreateRegisterInterestDto dto);
    Task<List<RegisterInterest>> GetByUserIdAsync(int userId);
    Task AdvanceStatusAsync(int registrationId);
}
