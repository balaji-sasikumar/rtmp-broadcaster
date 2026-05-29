# Add project specific ProGuard rules here.
# By default, the flags in this file are applied to the release build.
# https://developer.android.com/tools/help/proguard

# react-native-rtmp-publisher — keep native streaming classes
-keep class com.ekarabaev.** { *; }
-keep class net.ossrs.** { *; }
-keep class com.pedro.** { *; }

# React Native
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }
