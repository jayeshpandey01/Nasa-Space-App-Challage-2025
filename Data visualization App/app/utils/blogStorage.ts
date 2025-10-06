import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlogPost } from '../services/blogGenerator';
import { logger } from './logger';

export class BlogStorage {
  private static readonly BLOG_STORAGE_KEY = 'ai_generated_blogs';
  private static readonly BLOG_INDEX_KEY = 'blog_index';

  /**
   * Save a generated blog post to local storage
   */
  static async saveBlog(blogPost: BlogPost): Promise<void> {
    try {
      // Save the blog post
      await AsyncStorage.setItem(
        `${this.BLOG_STORAGE_KEY}_${blogPost.date}`,
        JSON.stringify(blogPost)
      );

      // Update the blog index
      await this.updateBlogIndex(blogPost.date, blogPost.id);

      logger.info('Blog saved successfully', { 
        blogId: blogPost.id, 
        date: blogPost.date 
      }, 'BlogStorage');
    } catch (error) {
      logger.error('Failed to save blog', { error, blogId: blogPost.id }, 'BlogStorage');
      throw error;
    }
  }

  /**
   * Load a blog post for a specific date
   */
  static async loadBlog(date: string): Promise<BlogPost | null> {
    try {
      const blogData = await AsyncStorage.getItem(`${this.BLOG_STORAGE_KEY}_${date}`);
      
      if (blogData) {
        const blogPost = JSON.parse(blogData) as BlogPost;
        logger.info('Blog loaded successfully', { 
          blogId: blogPost.id, 
          date: date 
        }, 'BlogStorage');
        return blogPost;
      }

      return null;
    } catch (error) {
      logger.error('Failed to load blog', { error, date }, 'BlogStorage');
      return null;
    }
  }

  /**
   * Check if a blog exists for a specific date
   */
  static async blogExists(date: string): Promise<boolean> {
    try {
      const blogData = await AsyncStorage.getItem(`${this.BLOG_STORAGE_KEY}_${date}`);
      return blogData !== null;
    } catch (error) {
      logger.error('Failed to check blog existence', { error, date }, 'BlogStorage');
      return false;
    }
  }

  /**
   * Get all available blog dates
   */
  static async getAllBlogDates(): Promise<string[]> {
    try {
      const indexData = await AsyncStorage.getItem(this.BLOG_INDEX_KEY);
      
      if (indexData) {
        const index = JSON.parse(indexData) as Record<string, string>;
        return Object.keys(index).sort().reverse(); // Most recent first
      }

      return [];
    } catch (error) {
      logger.error('Failed to get blog dates', { error }, 'BlogStorage');
      return [];
    }
  }

  /**
   * Delete a blog for a specific date
   */
  static async deleteBlog(date: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(`${this.BLOG_STORAGE_KEY}_${date}`);
      await this.removeFromBlogIndex(date);
      
      logger.info('Blog deleted successfully', { date }, 'BlogStorage');
    } catch (error) {
      logger.error('Failed to delete blog', { error, date }, 'BlogStorage');
      throw error;
    }
  }

  /**
   * Clear all stored blogs
   */
  static async clearAllBlogs(): Promise<void> {
    try {
      const dates = await this.getAllBlogDates();
      
      // Delete all blog posts
      const deletePromises = dates.map(date => 
        AsyncStorage.removeItem(`${this.BLOG_STORAGE_KEY}_${date}`)
      );
      
      await Promise.all(deletePromises);
      
      // Clear the index
      await AsyncStorage.removeItem(this.BLOG_INDEX_KEY);
      
      logger.info('All blogs cleared successfully', { count: dates.length }, 'BlogStorage');
    } catch (error) {
      logger.error('Failed to clear all blogs', { error }, 'BlogStorage');
      throw error;
    }
  }

  /**
   * Get storage statistics
   */
  static async getStorageStats(): Promise<{
    totalBlogs: number;
    oldestDate: string | null;
    newestDate: string | null;
    totalSize: number;
  }> {
    try {
      const dates = await this.getAllBlogDates();
      let totalSize = 0;

      // Calculate total size
      for (const date of dates) {
        const blogData = await AsyncStorage.getItem(`${this.BLOG_STORAGE_KEY}_${date}`);
        if (blogData) {
          totalSize += blogData.length;
        }
      }

      return {
        totalBlogs: dates.length,
        oldestDate: dates.length > 0 ? dates[dates.length - 1] : null,
        newestDate: dates.length > 0 ? dates[0] : null,
        totalSize
      };
    } catch (error) {
      logger.error('Failed to get storage stats', { error }, 'BlogStorage');
      return {
        totalBlogs: 0,
        oldestDate: null,
        newestDate: null,
        totalSize: 0
      };
    }
  }

  /**
   * Update the blog index with a new entry
   */
  private static async updateBlogIndex(date: string, blogId: string): Promise<void> {
    try {
      const indexData = await AsyncStorage.getItem(this.BLOG_INDEX_KEY);
      const index = indexData ? JSON.parse(indexData) : {};
      
      index[date] = blogId;
      
      await AsyncStorage.setItem(this.BLOG_INDEX_KEY, JSON.stringify(index));
    } catch (error) {
      logger.error('Failed to update blog index', { error, date, blogId }, 'BlogStorage');
      throw error;
    }
  }

  /**
   * Remove an entry from the blog index
   */
  private static async removeFromBlogIndex(date: string): Promise<void> {
    try {
      const indexData = await AsyncStorage.getItem(this.BLOG_INDEX_KEY);
      
      if (indexData) {
        const index = JSON.parse(indexData);
        delete index[date];
        
        await AsyncStorage.setItem(this.BLOG_INDEX_KEY, JSON.stringify(index));
      }
    } catch (error) {
      logger.error('Failed to remove from blog index', { error, date }, 'BlogStorage');
      throw error;
    }
  }

  /**
   * Clean up old blogs (keep only last N days)
   */
  static async cleanupOldBlogs(keepDays: number = 30): Promise<void> {
    try {
      const dates = await this.getAllBlogDates();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - keepDays);
      
      const datesToDelete = dates.filter(date => {
        const blogDate = new Date(date);
        return blogDate < cutoffDate;
      });

      // Delete old blogs
      const deletePromises = datesToDelete.map(date => this.deleteBlog(date));
      await Promise.all(deletePromises);

      logger.info('Old blogs cleaned up', { 
        deletedCount: datesToDelete.length,
        keepDays 
      }, 'BlogStorage');
    } catch (error) {
      logger.error('Failed to cleanup old blogs', { error, keepDays }, 'BlogStorage');
      throw error;
    }
  }
}