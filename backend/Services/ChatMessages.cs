namespace backend.Services;

/// The concierge's fixed replies — quota, greeting, off-topic, no-match and the grounded fallback —
/// in the languages the reply language resolver returns. The model writes everything else; these are
/// the lines the backend produces itself, and a French or Vietnamese visitor met them in English.
/// Keys are the values of ChatService.ResolveResponseLanguage; anything unknown falls back to English.
public static class ChatMessages
{
    private const string English = "english";
    private const string French = "french";
    private const string Vietnamese = "vietnamese";

    private static string Pick(string? language, string english, string french, string vietnamese) =>
        language switch
        {
            French => french,
            Vietnamese => vietnamese,
            _ => english,
        };

    public static string UnsupportedQuery(string? language) => Pick(language,
        "Tourbillon is your concierge for luxury watches — brands, collections, comparisons, and catalogue picks by style, size, material, or budget. Pick one of the starters below, or tell me a brand, a budget, or an occasion and I'll take it from there.",
        "Tourbillon est votre concierge en horlogerie de luxe : maisons, collections, comparaisons et sélections du catalogue par style, taille, matière ou budget. Choisissez une suggestion ci-dessous, ou indiquez-moi une maison, un budget ou une occasion et je m'en occupe.",
        "Tourbillon là trợ lý về đồng hồ cao cấp: các hãng, collection, so sánh, và gợi ý từ catalogue theo phong cách, kích thước, chất liệu hay ngân sách. Bạn chọn một gợi ý bên dưới, hoặc cho tôi biết hãng, ngân sách hay dịp sử dụng.");

    public static string NoCloseMatch(string? language) => Pick(language,
        "Nothing in the current Tourbillon catalogue lines up with that brief. Try one of the starters below, or rework the request with a specific brand, collection, reference, size, material, or budget and I'll find the closest matches.",
        "Rien dans le catalogue Tourbillon actuel ne correspond à cette demande. Essayez une suggestion ci-dessous, ou reformulez avec une maison, une collection, une référence, une taille, une matière ou un budget précis et je trouverai ce qui s'en rapproche le plus.",
        "Catalogue Tourbillon hiện chưa có mẫu nào khớp với yêu cầu đó. Bạn thử một gợi ý bên dưới, hoặc nêu rõ hãng, collection, mã tham chiếu, kích thước, chất liệu hay ngân sách để tôi tìm những mẫu gần nhất.");

    public static string ProcessingFallback(string? language) => Pick(language,
        "Give me a second chance on that one — try a starter below, or rephrase with a brand, a model, a comparison, a style, or a budget and Tourbillon will surface the right catalogue matches.",
        "Laissez-moi une seconde chance : essayez une suggestion ci-dessous, ou reformulez avec une maison, un modèle, une comparaison, un style ou un budget et Tourbillon fera remonter les bonnes références.",
        "Cho tôi thử lại nhé: bạn chọn một gợi ý bên dưới, hoặc nêu lại theo hãng, mẫu, so sánh, phong cách hay ngân sách để Tourbillon đưa ra đúng mẫu trong catalogue.");

    public static string AdviceNoMatch(string? language) => Pick(language,
        "Tell me a little more — your budget, your wrist size, and how dressy you want it to read — and Tourbillon can point you to the right pieces.",
        "Dites-m'en un peu plus — votre budget, votre tour de poignet et le degré d'habillé recherché — et Tourbillon saura vous orienter vers les bonnes pièces.",
        "Bạn cho tôi biết thêm một chút: ngân sách, cỡ cổ tay, và mức độ lịch sự bạn muốn. Khi đó Tourbillon sẽ chỉ cho bạn những mẫu phù hợp.");

    public static string DailyQuota(string? language, int dailyLimit) => Pick(language,
        $"You have reached your daily concierge quota of {dailyLimit} messages. Please come back tomorrow.",
        $"Vous avez atteint votre quota quotidien de {dailyLimit} messages avec le concierge. Revenez demain.",
        $"Bạn đã dùng hết {dailyLimit} tin nhắn concierge trong ngày. Mời bạn quay lại vào ngày mai.");

    public static string Greeting(string? language) => Pick(language,
        "Hello. Tourbillon can help compare watches, explain brands or collections, and narrow a brief into real catalogue options. Try something like \"compare the Aquanaut and the Overseas\", \"tell me about Vacheron Constantin\", or \"JLC Reverso under 50k\".",
        "Bonjour. Tourbillon peut comparer des montres, présenter une maison ou une collection, et transformer une envie en références concrètes du catalogue. Essayez par exemple « comparez l'Aquanaut et l'Overseas », « parlez-moi de Vacheron Constantin » ou « JLC Reverso sous 50k ».",
        "Xin chào. Tourbillon có thể so sánh đồng hồ, giới thiệu một hãng hay một collection, và thu hẹp yêu cầu của bạn thành những mẫu có thật trong catalogue. Bạn thử hỏi \"so sánh Aquanaut và Overseas\", \"giới thiệu về Vacheron Constantin\", hay \"JLC Reverso dưới 50k\".");

    public static string WatchesOnly(string? language) => Pick(language,
        "I am here to help with Tourbillon watches and horology only. If you want, ask about a watch, brand, comparison, or product search.",
        "Je suis là uniquement pour les montres Tourbillon et l'horlogerie. Posez-moi une question sur une montre, une maison, une comparaison ou une recherche de produit.",
        "Tôi chỉ hỗ trợ về đồng hồ Tourbillon và lĩnh vực horology. Bạn có thể hỏi về một mẫu đồng hồ, một hãng, một so sánh, hoặc tìm sản phẩm.");

    public static string AllCurrentModels(string? language) => Pick(language,
        "Those are all the current models from these collections in the Tourbillon catalogue. Let me know if you'd like to compare any two or explore a different brief.",
        "Ce sont toutes les références actuelles de ces collections dans le catalogue Tourbillon. Dites-moi si vous souhaitez en comparer deux ou partir sur une autre demande.",
        "Đó là tất cả các mẫu hiện có của những collection này trong catalogue Tourbillon. Bạn muốn so sánh hai mẫu bất kỳ hay đổi sang yêu cầu khác thì cho tôi biết.");

    public static string WhatAreYouLookingFor(string? language) => Pick(language,
        "What are you looking for? I can suggest watches, brands, or collections.",
        "Que recherchez-vous ? Je peux vous suggérer des montres, des maisons ou des collections.",
        "Bạn đang tìm gì? Tôi có thể gợi ý đồng hồ, hãng, hoặc collection.");

    public static string NoStrongerShortlist(string? language) => Pick(language,
        "Tourbillon could not find a stronger revised shortlist in the current catalogue yet. Try narrowing by material, occasion, price, or a specific brand.",
        "Tourbillon n'a pas encore trouvé de sélection révisée plus convaincante dans le catalogue actuel. Essayez de préciser la matière, l'occasion, le prix ou une maison.",
        "Tourbillon chưa tìm được danh sách sửa lại tốt hơn trong catalogue hiện tại. Bạn thử thu hẹp theo chất liệu, dịp sử dụng, giá, hoặc một hãng cụ thể.");

    public static string NeedOneMoreDetail(string? language) => Pick(language,
        "I need one more specific watch, brand, or collection detail to continue from the previous results.",
        "Il me faut une précision de plus — une montre, une maison ou une collection — pour poursuivre à partir des résultats précédents.",
        "Tôi cần thêm một chi tiết cụ thể về mẫu đồng hồ, hãng hoặc collection để tiếp tục từ kết quả trước.");

    /// The grounded fallback, used when the model's own wording fails the catalogue check twice. The
    /// links are built by the caller and read the same in every language.
    public static string StrongestMatches(string? language, string firstLink, string? secondLink) =>
        secondLink == null
            ? Pick(language,
                $"{firstLink} is the clearest catalogue match Tourbillon surfaced. If you want, ask about size, material, or a nearby alternative.",
                $"{firstLink} est la référence du catalogue qui correspond le mieux. Dites-moi si vous voulez parler taille, matière, ou une alternative proche.",
                $"{firstLink} là mẫu khớp nhất mà Tourbillon tìm được. Bạn có thể hỏi thêm về kích thước, chất liệu, hoặc một lựa chọn tương tự.")
            : Pick(language,
                $"{firstLink} and {secondLink} are the strongest catalogue matches Tourbillon surfaced. If you want, compare them side by side or narrow by size, material, or budget.",
                $"{firstLink} et {secondLink} sont les références du catalogue qui correspondent le mieux. Comparez-les côte à côte, ou affinez par taille, matière ou budget.",
                $"{firstLink} và {secondLink} là hai mẫu khớp nhất mà Tourbillon tìm được. Bạn có thể so sánh hai mẫu này, hoặc thu hẹp theo kích thước, chất liệu hay ngân sách.");
}
