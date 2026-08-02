# Needs the full JDK, not a JRE: the tracer compiles with javax.tools and steps
# the child JVM through jdk.jdi.
FROM eclipse-temurin:21-jdk

WORKDIR /app
COPY Visualizer.java index.html presets.js fonts.css ./
COPY fonts ./fonts

# PORT is injected by the host; VIZ_USER/VIZ_PASS are required to listen publicly.
ENV PORT=8080
EXPOSE 8080
CMD ["java", "Visualizer.java"]
