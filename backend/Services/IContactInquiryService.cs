// Contact advisor inquiry — saves to DB, sends confirmation + admin notification emails
using backend.Models;

namespace backend.Services;

public interface IContactInquiryService
{
    Task<ContactInquiry> SendInquiryAsync(int userId, CreateContactInquiryDto dto);
}
