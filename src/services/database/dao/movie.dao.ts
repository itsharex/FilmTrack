/**
 * 电影数据访问对象
 * 提供电影数据的CRUD操作
 * @author yanstu
 */

import type { ApiResponse, Movie, SeasonsData, DatabaseRow } from '../../../types'
import { DatabaseConnection } from '../connection'
import { DatabaseUtils } from '../utils'

/**
 * 电影数据访问对象
 */
export class MovieDAO {
  /**
   * 获取电影列表
   * @param status 筛选状态
   * @param limit 限制数量
   * @param offset 偏移量
   */
  static async getMovies(
    status?: string, 
    limit?: number, 
    offset?: number
  ): Promise<ApiResponse<Movie[]>> {
    try {
      const db = await DatabaseConnection.getInstance()
      
      let query = 'SELECT * FROM movies'
      const params: unknown[] = []
      
      if (status) {
        query += ' WHERE status = $1'
        params.push(status)
      }
      
      // 统一排序：按最后更新时间降序排列
      query += ' ORDER BY date_updated DESC'
      
      if (limit) {
        const limitParam = status ? '$2' : '$1'
        query += ` LIMIT ${limitParam}`
        params.push(limit)
        
        if (offset) {
          const offsetParam = status ? '$3' : '$2'
          query += ` OFFSET ${offsetParam}`
          params.push(offset)
        }
      }
      
      const result = await db.select(query, params) as DatabaseRow[]
      
      // 解析JSON字段
      const movies: Movie[] = result.map((row: DatabaseRow) => ({
        ...row,
        genres: DatabaseUtils.parseJsonField<string[]>(row.genres),
        tags: DatabaseUtils.parseJsonField<string[]>(row.tags),
        seasons_data: DatabaseUtils.parseJsonField<SeasonsData>(row.seasons_data)
      }))
      
      return { success: true, data: movies }
    } catch (error) {
      return { success: false, error: `获取电影列表失败: ${error}` }
    }
  }

  /**
   * 根据ID获取电影
   * @param id 电影ID
   */
  static async getMovieById(id: string): Promise<ApiResponse<Movie | null>> {
    try {
      const db = await DatabaseConnection.getInstance()
      const result = await db.select('SELECT * FROM movies WHERE id = $1', [id]) as DatabaseRow[]
      
      if (result.length === 0) {
        return { success: true, data: null }
      }
      
      const row = result[0]
      const movie: Movie = {
        ...row,
        genres: DatabaseUtils.parseJsonField<string[]>(row.genres),
        seasons_data: DatabaseUtils.parseJsonField<SeasonsData>(row.seasons_data)
      }
      
      return { success: true, data: movie }
    } catch (error) {
      return { success: false, error: `获取电影详情失败: ${error}` }
    }
  }

  /**
   * 添加电影
   * @param movie 电影数据
   */
  static async addMovie(movie: Partial<Movie>): Promise<ApiResponse<Movie>> {
    try {
      const db = await DatabaseConnection.getInstance()
      const id = await DatabaseUtils.generateUuid()
      const timestamp = await DatabaseUtils.getCurrentTimestamp()
      
      // 字段规则：
      // - created_at: 添加到数据库的时间，不可修改
      // - date_added: 初次观看时间，从watched_date设置或使用当前时间
      // - date_updated: 每次更新影视信息时修改为最新时间
      const dateAdded = (movie as Partial<Movie> & { watched_date?: string }).watched_date || timestamp
      const dateUpdated = timestamp
      
      // 使用与数据库表匹配的字段
      const query = `
        INSERT INTO movies (
          id, title, original_title, year, type, tmdb_id, poster_path,
          overview, status, personal_rating, tmdb_rating, notes, watch_source,
          current_episode, current_season, air_status, total_episodes, total_seasons, seasons_data,
          date_added, date_updated, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
      `
      
      const params = [
        id,
        movie.title || '',
        (movie as Partial<Movie> & { original_title?: string }).original_title || null,
        (movie as Partial<Movie> & { year?: number }).year || null,
        (movie as Partial<Movie> & { type?: string }).type || 'movie',
        (movie as Partial<Movie> & { tmdb_id?: number }).tmdb_id || null,
        movie.poster_path || null,
        movie.overview || null,
        movie.status || 'watching',
        (movie as Partial<Movie> & { personal_rating?: number }).personal_rating || null,
        (movie as Partial<Movie> & { tmdb_rating?: number }).tmdb_rating || null,
        (movie as Partial<Movie> & { notes?: string }).notes || null,
        (movie as Partial<Movie> & { watch_source?: string }).watch_source || null,
        (movie as Partial<Movie> & { current_episode?: number }).current_episode || 0,
        (movie as Partial<Movie> & { current_season?: number }).current_season || 1,
        (movie as Partial<Movie> & { air_status?: string }).air_status || null,
        (movie as Partial<Movie> & { total_episodes?: number }).total_episodes || null,
        (movie as Partial<Movie> & { total_seasons?: number }).total_seasons || null,
        (movie as Partial<Movie> & { seasons_data?: SeasonsData }).seasons_data ? JSON.stringify((movie as Partial<Movie> & { seasons_data?: SeasonsData }).seasons_data) : null,
        dateAdded,
        dateUpdated,
        timestamp,
        timestamp
      ]

      await db.execute(query, params)
      
      const newMovie: Movie = {
        id,
        title: movie.title || '',
        original_title: (movie as Partial<Movie> & { original_title?: string }).original_title || null,
        year: (movie as Partial<Movie> & { year?: number }).year || null,
        type: (movie as Partial<Movie> & { type?: string }).type || 'movie',
        tmdb_id: (movie as Partial<Movie> & { tmdb_id?: number }).tmdb_id || null,
        poster_path: movie.poster_path || null,
        overview: movie.overview || null,
        status: movie.status || 'watching',
        personal_rating: (movie as Partial<Movie> & { personal_rating?: number }).personal_rating || 0,
        tmdb_rating: (movie as Partial<Movie> & { tmdb_rating?: number }).tmdb_rating || null,
        notes: (movie as Partial<Movie> & { notes?: string }).notes || null,
        watch_source: (movie as Partial<Movie> & { watch_source?: string }).watch_source || null,
        current_episode: (movie as Partial<Movie> & { current_episode?: number }).current_episode || 0,
        current_season: (movie as Partial<Movie> & { current_season?: number }).current_season || 1,
        air_status: (movie as Partial<Movie> & { air_status?: string }).air_status || null,
        total_episodes: (movie as Partial<Movie> & { total_episodes?: number }).total_episodes || null,
        total_seasons: (movie as Partial<Movie> & { total_seasons?: number }).total_seasons || null,
        date_added: dateAdded,
        date_updated: dateUpdated,
        created_at: timestamp,
        updated_at: timestamp,
        genres: [],
        vote_average: 0,
        watch_count: 0
      } as Movie
      
      return { success: true, data: newMovie }
    } catch (error) {
      console.error('数据库添加电影失败:', error)
      return { success: false, error: `添加影视作品失败: ${error}` }
    }
  }

  /**
   * 更新电影
   * @param movie 电影数据
   */
  static async updateMovie(movie: Movie): Promise<ApiResponse<Movie>> {
    try {
      const db = await DatabaseConnection.getInstance()
      const timestamp = await DatabaseUtils.getCurrentTimestamp()
      
      // 先查询原始数据用于比较变更
      const originalResult = await db.select('SELECT watched_date, current_season, current_episode, date_updated FROM movies WHERE id = $1', [movie.id]) as DatabaseRow[]
      if (originalResult.length === 0) {
        return { success: false, error: '电影不存在' }
      }
      const originalData = originalResult[0]
      
      // 字段规则：
      // - date_added: 根据观看日期更新，如果没有观看日期则使用当前时间
      // - date_updated: 复杂逻辑判断
      //   1. 如果用户修改了观看日期，date_updated同步为该日期
      //   2. 如果用户未修改观看日期但修改了季数或集数，date_updated设为当前时间
      //   3. 如果都未修改，date_updated保持原值
      //   4. 观看日期的优先级最高
      const dateAdded = (movie as Partial<Movie> & { watched_date?: string }).watched_date || timestamp
      
      let dateUpdated: string
      const currentWatchedDate = (movie as Partial<Movie> & { watched_date?: string }).watched_date
      const originalWatchedDate = originalData.watched_date as string
      const currentSeason = (movie as Partial<Movie> & { current_season?: number }).current_season
      const currentEpisode = (movie as Partial<Movie> & { current_episode?: number }).current_episode
      const originalSeason = originalData.current_season
      const originalEpisode = originalData.current_episode
      
      // 判断观看日期是否发生变更
      const watchedDateChanged = currentWatchedDate !== originalWatchedDate
      // 判断季数或集数是否发生变更
      const seasonOrEpisodeChanged = currentSeason !== originalSeason || currentEpisode !== originalEpisode
      
      if (watchedDateChanged && currentWatchedDate) {
        // 优先级最高：用户修改了观看日期，date_updated同步为该日期
        dateUpdated = currentWatchedDate
      } else if (!watchedDateChanged && seasonOrEpisodeChanged) {
        // 用户未修改观看日期但修改了季数或集数，date_updated设为当前时间
        dateUpdated = timestamp
      } else {
        // 都未修改，date_updated保持原值
        dateUpdated = originalData.date_updated || timestamp
      }
      
      const query = `
        UPDATE movies SET 
          title = $1, overview = $2, poster_path = $3, backdrop_path = $4, 
          year = $5, tmdb_rating = $6, runtime = $7, genres = $8,
          status = $9, personal_rating = $10, watch_count = $11, 
          current_episode = $12, current_season = $13, total_episodes = $14, total_seasons = $15,
          air_status = $16, notes = $17, watch_source = $18,
          date_added = $19, date_updated = $20, updated_at = $21
        WHERE id = $22
      `
      
      const movieWithExtras = movie as Partial<Movie> & {
        year?: number;
        tmdb_rating?: number;
        personal_rating?: number;
        watch_count?: number;
        current_episode?: number;
        current_season?: number;
        total_episodes?: number;
        total_seasons?: number;
        air_status?: string;
        notes?: string;
        watch_source?: string;
      }
      
      const params = [
        movie.title,
        movie.overview || null,
        movie.poster_path || null,
        movie.backdrop_path || null,
        movieWithExtras.year || null,
        movieWithExtras.tmdb_rating || 0.0,
        movie.runtime || null,
        DatabaseUtils.stringifyJsonField(movie.genres),
        movie.status,
        movieWithExtras.personal_rating || null,
        movieWithExtras.watch_count || 0,
        movieWithExtras.current_episode !== undefined ? movieWithExtras.current_episode : 0,
        movieWithExtras.current_season !== undefined ? movieWithExtras.current_season : 1,
        movieWithExtras.total_episodes || null,
        movieWithExtras.total_seasons || null,
        movieWithExtras.air_status || null,
        movieWithExtras.notes || null,
        movieWithExtras.watch_source || null,
        dateAdded,
        dateUpdated,
        timestamp,
        movie.id
      ]
      
      await db.execute(query, params)
      
      return { 
        success: true, 
        data: { ...movie, date_added: dateAdded, date_updated: dateUpdated, updated_at: timestamp } 
      }
    } catch (error) {
      return { success: false, error: `更新电影失败: ${error}` }
    }
  }

  /**
   * 删除电影
   * @param movieId 电影ID
   */
  static async deleteMovie(movieId: string): Promise<ApiResponse<string>> {
    try {
      const db = await DatabaseConnection.getInstance()
      await db.execute('DELETE FROM movies WHERE id = $1', [movieId])
      return { success: true, data: '电影删除成功' }
    } catch (error) {
      return { success: false, error: `删除电影失败: ${error}` }
    }
  }

  /**
   * 获取所有电影（用于兼容性）
   */
  static async getAllMovies(): Promise<ApiResponse<Movie[]>> {
    return this.getMovies()
  }

  /**
   * 查找电影（兼容旧版API）
   */
  static async findAll(
    status?: string, 
    limit?: number, 
    offset?: number
  ): Promise<Movie[]> {
    const result = await this.getMovies(status, limit, offset)
    return result.success ? result.data : []
  }

  /**
   * 查找单个电影（兼容旧版API）
   */
  static async findById(id: string): Promise<Movie | null> {
    const result = await this.getMovieById(id)
    return result.success ? result.data : null
  }

  /**
   * 创建电影（兼容旧版API）
   */
  static async create(movie: Partial<Movie>): Promise<Movie> {
    const result = await this.addMovie(movie)
    if (!result.success) {
      throw new Error(result.error)
    }
    return result.data
  }

  /**
   * 更新电影（兼容旧版API）
   */
  static async update(movie: Movie): Promise<Movie> {
    const result = await this.updateMovie(movie)
    if (!result.success) {
      throw new Error(result.error)
    }
    return result.data
  }

  /**
   * 删除电影（兼容旧版API）
   */
  static async delete(id: string): Promise<boolean> {
    const result = await this.deleteMovie(id)
    return result.success
  }
}