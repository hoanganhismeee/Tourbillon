# Backend Dockerfile — .NET 8 API with Chromium for Selenium scraping
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY backend.csproj .
RUN dotnet restore
COPY . .
RUN dotnet publish -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium chromium-driver curl \
    && rm -rf /var/lib/apt/lists/*
ENV CHROME_BIN=/usr/bin/chromium
ENV CHROMEDRIVER_PATH=/usr/bin
WORKDIR /app
COPY --from=build /app/publish .
RUN mkdir -p /app/Images /app/Data
EXPOSE 8080
ENTRYPOINT ["dotnet", "backend.dll"]
