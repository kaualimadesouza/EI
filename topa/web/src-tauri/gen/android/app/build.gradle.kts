import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("rust")
}

val rawVersionName = providers.fileContents(layout.projectDirectory.file("tauri.properties")).asText
    .map { props ->
        val match = Regex("""tauri\.android\.versionName=(.+)""").find(props)
        match?.groupValues?.get(1)?.trim() ?: "0.1.3"
    }.orElse("0.1.3").get()

val cleanVersion = rawVersionName.substringBefore('-')
val parts = cleanVersion.split('.').mapNotNull { it.toIntOrNull() }
val computedVersionCode = if (parts.size >= 3) {
    parts[0] * 100000 + parts[1] * 1000 + parts[2]
} else {
    1
}

val tauriPackageEnv = providers.environmentVariable("TAURI_ANDROID_PACKAGE_UNESCAPED").orNull
    ?: providers.environmentVariable("WRY_ANDROID_PACKAGE").orNull
val flavorProp = providers.gradleProperty("appFlavor").orNull
val tauriConfAsset = file("src/main/assets/tauri.conf.json")
val isLoja = (tauriPackageEnv?.contains("loja") == true)
    || (flavorProp == "loja")
    || (tauriConfAsset.exists() && tauriConfAsset.readText().contains("topa.loja"))

val resolvedAppId = if (isLoja) "io.github.kaualimadesouza.topa.loja" else "io.github.kaualimadesouza.topa"
val resolvedAppName = if (isLoja) "TOPA Loja" else "TOPA"

android {
    compileSdk = 37
    namespace = resolvedAppId
    defaultConfig {
        manifestPlaceholders["usesCleartextTraffic"] = "false"
        manifestPlaceholders["appName"] = resolvedAppName
        applicationId = resolvedAppId
        minSdk = 24
        targetSdk = 37
        versionCode = computedVersionCode
        versionName = rawVersionName
    }
    sourceSets {
        getByName("main") {
            if (isLoja) {
                manifest.srcFile("src/loja/AndroidManifest.xml")
                res.srcDirs("src/loja/res", "src/main/res")
                java.srcDirs("src/loja/java", "src/main/java")
            } else {
                manifest.srcFile("src/cliente/AndroidManifest.xml")
                res.srcDirs("src/cliente/res", "src/main/res")
                java.srcDirs("src/cliente/java", "src/main/java")
            }
        }
        getByName("test") {
            java.srcDirs("src/test/java", "src/loja/java")
        }
    }
    buildTypes {
        getByName("debug") {
            applicationIdSuffix = ".debug"
            manifestPlaceholders["usesCleartextTraffic"] = "true"
            isDebuggable = true
            isJniDebuggable = true
            isMinifyEnabled = false
            packaging {
                jniLibs.keepDebugSymbols.add("*/arm64-v8a/*.so")
                jniLibs.keepDebugSymbols.add("*/armeabi-v7a/*.so")
                jniLibs.keepDebugSymbols.add("*/x86/*.so")
                jniLibs.keepDebugSymbols.add("*/x86_64/*.so")
            }
        }
        getByName("release") {
            optimization {
               enable = true
            }
            proguardFiles(
                *fileTree(".") {
                  include("**/*.pro")
                  exclude("build/**")
                }.files.toTypedArray()
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_1_8
        targetCompatibility = JavaVersion.VERSION_1_8
    }
    buildFeatures {
        buildConfig = true
    }
}

kotlin {
    compilerOptions {
        jvmTarget = JvmTarget.JVM_1_8
    }
}

rust {
    rootDirRel = "../../../"
}

dependencies {
    implementation("androidx.webkit:webkit:1.14.0")
    implementation("androidx.appcompat:appcompat:1.7.1")
    implementation("androidx.activity:activity-ktx:1.10.1")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.lifecycle:lifecycle-process:2.10.0")
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.1.4")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.5.0")
}

apply(from = file("tauri.build.gradle.kts"))
