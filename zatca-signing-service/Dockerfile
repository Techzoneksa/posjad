# ---------- Build stage ----------
# Java 21 required by ZATCA SDK 4.0.0 (class file version 65.0).
FROM maven:3.9.9-eclipse-temurin-21 AS build
WORKDIR /build

# ZATCA SDK jar version. Override at build time if needed:
#   docker build --build-arg ZATCA_SDK_VERSION=4.0.0 -t zatca-signing-service:0.1.10 .
# The jar must exist at libs/sdk-${ZATCA_SDK_VERSION}-jar-with-dependencies.jar
ARG ZATCA_SDK_VERSION=4.0.0
ENV ZATCA_SDK_VERSION=${ZATCA_SDK_VERSION}

COPY pom.xml .
COPY libs ./libs
COPY src ./src

# Fail fast if the SDK jar is missing
RUN test -f libs/sdk-${ZATCA_SDK_VERSION}-jar-with-dependencies.jar \
  || (echo "ERROR: place ZATCA SDK jar at libs/sdk-${ZATCA_SDK_VERSION}-jar-with-dependencies.jar before building. See README.md" && exit 1)

RUN mvn -B -ntp -DskipTests -Dzatca.sdk.version=${ZATCA_SDK_VERSION} package

# ---------- Runtime stage ----------
# Java 21 runtime required by ZATCA SDK 4.0.0 (class file version 65.0).
FROM eclipse-temurin:21-jre
WORKDIR /app

ARG ZATCA_SDK_VERSION=4.0.0
ENV ZATCA_SDK_VERSION=${ZATCA_SDK_VERSION}

# Shaded application jar (Jackson + handlers). Excludes the SDK (system-scope).
COPY --from=build /build/target/zatca-signing-service-0.1.16.jar app.jar
# ZATCA SDK fat-jar — added to runtime classpath via -cp.
COPY --from=build /build/libs/sdk-${ZATCA_SDK_VERSION}-jar-with-dependencies.jar /app/libs/sdk.jar

ENV JAVA_OPTS="-XX:MaxRAMPercentage=75 -XX:+ExitOnOutOfMemoryError"
ENV PORT=8080
EXPOSE 8080

ENTRYPOINT ["sh","-c","exec java $JAVA_OPTS -cp app.jar:/app/libs/sdk.jar com.yellowchicken.zatca.SigningServiceApplication"]
