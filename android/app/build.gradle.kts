plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}
android {
    namespace = "com.fearindexalarm"
    compileSdk = 35
    defaultConfig {
        applicationId = "com.fearindexalarm"
        minSdk = 26
        targetSdk = 35
        versionCode = 3
        versionName = "0.2.1"
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    sourceSets["test"].resources.srcDir("../../shared")
}
dependencies {
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.json:json:20240303")
}
