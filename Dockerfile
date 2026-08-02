# Needs the full JDK, not a JRE: the tracer compiles with javax.tools and steps
# the child JVM through jdk.jdi.
FROM eclipse-temurin:21-jdk

WORKDIR /app
COPY Visualizer.java index.html presets.js fonts.css ./
COPY fonts ./fonts

# PORT is injected by the host; VIZ_USER/VIZ_PASS are required to listen publicly.
ENV PORT=8080
EXPOSE 8080
# The parent JVM holds the server and javac; the traced child gets its own -Xmx96m.
# Both must fit a 512MB free instance, or the child dies before the JDWP handshake.
CMD ["java", "-Xmx160m", "Visualizer.java"]
