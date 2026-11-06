# ProGuard / R8 rules for J.A.R.V.I.S. for Wear OS (V6)
-keepattributes *Annotation*,InnerClasses,Signature,Exceptions
-keep class com.jarvis.wear.ai.** { *; }
-keep class com.jarvis.wear.data.database.** { *; }
-keep class * extends androidx.room.RoomDatabase { *; }
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn com.google.crypto.tink.**

