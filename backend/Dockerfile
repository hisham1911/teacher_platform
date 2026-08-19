# syntax=docker/dockerfile:1.7

ARG DOTNET_VERSION=10.0

FROM mcr.microsoft.com/dotnet/sdk:${DOTNET_VERSION} AS build
WORKDIR /src

COPY src/TeacherPlatform.Domain/TeacherPlatform.Domain.csproj src/TeacherPlatform.Domain/
COPY src/TeacherPlatform.Application/TeacherPlatform.Application.csproj src/TeacherPlatform.Application/
COPY src/TeacherPlatform.Infrastructure/TeacherPlatform.Infrastructure.csproj src/TeacherPlatform.Infrastructure/
COPY src/TeacherPlatform.Api/TeacherPlatform.Api.csproj src/TeacherPlatform.Api/
RUN dotnet restore src/TeacherPlatform.Api/TeacherPlatform.Api.csproj --runtime linux-x64

COPY src/ src/
RUN dotnet publish src/TeacherPlatform.Api/TeacherPlatform.Api.csproj \
    --configuration Release \
    --runtime linux-x64 \
    --self-contained false \
    --no-restore \
    --output /out/app \
    /p:UseAppHost=false \
 && rm -f \
    /out/app/appsettings.E2E.json \
    /out/app/appsettings.Example.json \
    /out/app/appsettings.Testing.json

RUN dotnet tool install dotnet-ef --tool-path /tools --version 10.0.10 \
 && /tools/dotnet-ef migrations bundle \
    --configuration Release \
    --runtime linux-x64 \
    --output /out/efbundle \
    --project src/TeacherPlatform.Infrastructure/TeacherPlatform.Infrastructure.csproj \
    --startup-project src/TeacherPlatform.Api/TeacherPlatform.Api.csproj \
 && chmod 0555 /out/efbundle

FROM mcr.microsoft.com/dotnet/aspnet:${DOTNET_VERSION} AS runtime
RUN apt-get update \
 && apt-get install --yes --no-install-recommends ca-certificates fontconfig fonts-dejavu-core \
 && fc-match "DejaVu Sans" \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=build /out/app/ ./
COPY --from=build /out/efbundle ./efbundle

ENV ASPNETCORE_ENVIRONMENT=Production
EXPOSE 10000

CMD ["sh", "-c", "/app/efbundle && exec dotnet TeacherPlatform.Api.dll --urls http://0.0.0.0:${PORT:-10000}"]
