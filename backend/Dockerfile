# 使用官方的OpenJDK镜像作为基础镜像
FROM openjdk:17

# 设置工作目录
WORKDIR /app

# 复制Maven构建的JAR文件
COPY target/backend-0.0.1-SNAPSHOT.jar app.jar

# 复制配置文件
COPY src/main/resources/application-docker.properties application-docker.properties
COPY src/main/resources/application.properties application.properties

# 创建上传目录
RUN mkdir -p /app/uploads/documents

# 暴露端口
EXPOSE 8080

# 设置环境变量
ENV JAVA_OPTS="-Xmx512m -Xms256m"

# 启动应用
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
