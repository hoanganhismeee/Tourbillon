// Register and Login Users
namespace backend.Models;

public class User
{
    public int Id { get; set; }
    public string FirstName { get; set; } = string.Empty; //string.empty because it will alway be filled
    public string LastName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public int? Phone { get; set; } //int? because it can be optional (fill or not)
    public string? Address { get; set; }
    public string? City { get; set; }
    public string? State { get; set; }
    public string? Country { get; set; }
}   