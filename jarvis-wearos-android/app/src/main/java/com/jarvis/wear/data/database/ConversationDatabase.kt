package com.jarvis.wear.data.database

import android.content.Context
import androidx.room.*
import com.jarvis.wear.ai.ChatTurn
import kotlinx.coroutines.flow.Flow

@Entity(tableName = "dialogue_messages")
data class MessageEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val role: String, // "user" or "assistant"
    val content: String,
    val timestamp: Long = System.currentTimeMillis()
)

@Dao
interface MessageDao {
    @Query("SELECT * FROM dialogue_messages ORDER BY timestamp ASC")
    fun observeAllMessages(): Flow<List<MessageEntity>>

    @Query("SELECT * FROM dialogue_messages ORDER BY timestamp DESC LIMIT :limit")
    suspend fun getRecentMessages(limit: Int = 10): List<MessageEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertMessage(message: MessageEntity): Long

    @Query("DELETE FROM dialogue_messages")
    suspend fun clearAllMessages()
}

@Database(entities = [MessageEntity::class], version = 1, exportSchema = false)
abstract class ConversationDatabase : RoomDatabase() {
    abstract fun messageDao(): MessageDao

    companion object {
        @Volatile
        private var INSTANCE: ConversationDatabase? = null

        fun getInstance(context: Context): ConversationDatabase {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: Room.databaseBuilder(
                    context.applicationContext,
                    ConversationDatabase::class.java,
                    "jarvis_wear_dialogue.db"
                )
                    .fallbackToDestructiveMigration()
                    .build()
                    .also { INSTANCE = it }
            }
        }
    }
}

/**
 * Pure helper for managing conversation context window on Wear OS.
 */
object ConversationMemoryHelper {
    fun buildContextWindow(
        messages: List<MessageEntity>,
        memoryEnabled: Boolean,
        maxTurns: Int = 6
    ): List<ChatTurn> {
        if (!memoryEnabled || messages.isEmpty()) return emptyList()
        return messages
            .sortedBy { it.timestamp }
            .takeLast(maxTurns)
            .map { ChatTurn(role = it.role, content = it.content) }
    }
}
