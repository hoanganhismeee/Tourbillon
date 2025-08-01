// This service handles account deletion operations, following Single Responsibility Principle.
using backend.Models;

namespace backend.Services;

public interface IAccountDeletionService
{
    Task<(bool success, string message)> DeleteAccountAsync(string userId, DeleteAccountDto deleteDto);
} 