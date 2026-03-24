// Service interface for Register Your Interest submissions
using backend.Models;

namespace backend.Services;

public interface IRegisterInterestService
{
    Task<RegisterInterest> RegisterAsync(int? userId, CreateRegisterInterestDto dto);
}
