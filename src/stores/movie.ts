/**
 * 影视作品状态管理 Store
 * @author yanstu
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { tmdbAPI } from '../utils/api';
import { databaseAPI } from '../services/database-api';
import type {
  Movie,
  ParsedMovie,
  TMDbMovie,
  TMDbMovieDetail,
  ReplayRecord,
  Statistics,
  AddMovieForm,
  UpdateMovieForm,
  ReplayRecordForm,
  SearchFilters,
  Pagination,
  ViewMode,
  LoadingState,
  ApiResponse,
  MovieType,
  Status
} from '../types';


export const useMovieStore = defineStore('movie', () => {
  // ==================== 状态 ====================
  
  // 影视作品列表
  const movies = ref<ParsedMovie[]>([]);
  
  // 当前查看的影视作品
  const currentMovie = ref<ParsedMovie | null>(null);
  
  // TMDb搜索结果
  const searchResults = ref<TMDbMovie[]>([]);
  
  // 热门影视作品
  const popularMovies = ref<TMDbMovie[]>([]);
  const popularTVShows = ref<TMDbMovie[]>([]);
  
  // 筛选条件
  const filters = ref<SearchFilters>({
    query: '',
    type: [],
    status: [],
    genres: [],
    sortBy: 'date_updated',
    sortOrder: 'desc'
  });
  
  // 分页信息
  const pagination = ref<Pagination>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0
  });
  
  // 视图模式
  const viewMode = ref<ViewMode>('grid');
  
  // 加载状态
  const loadingState = ref<LoadingState>({
    loading: false,
    error: undefined
  });
  
  // TMDb搜索加载状态
  const searchLoading = ref(false);
  
  // 热门内容加载状态
  const popularLoading = ref(false);

  // 观看历史
  const replayRecords = ref<ReplayRecord[]>([]);

  // ==================== 计算属性 ====================
  
  // 筛选后的影视作品数量
  const filteredCount = computed(() => pagination.value.total);
  
  // 是否有影视作品
  const hasMovies = computed(() => movies.value.length > 0);
  
  // 是否正在加载
  const isLoading = computed(() => loadingState.value.loading);
  
  // 错误信息
  const error = computed(() => loadingState.value.error);
  
  // 当前页码范围信息
  const pageInfo = computed(() => {
    const { page, pageSize, total } = pagination.value;
    const start = Math.min((page - 1) * pageSize + 1, total);
    const end = Math.min(page * pageSize, total);
    return { start, end, total };
  });

  // 影视作品按状态分类
  const moviesByStatus = computed(() => {
    return {
      watching: movies.value.filter(m => m.status === 'watching'),
      completed: movies.value.filter(m => m.status === 'completed'),
      planned: movies.value.filter(m => m.status === 'planned'),
      dropped: movies.value.filter(m => m.status === 'dropped')
    };
  });

  // 影视作品数量统计
  const totalMovies = computed(() => movies.value.length);
  const completedMovies = computed(() => moviesByStatus.value.completed.length);
  const watchingMovies = computed(() => moviesByStatus.value.watching.length);

  // 影视作品统计信息
  const statistics = computed(() => {
    const totalWatchTime = movies.value
      .filter(m => m.status === 'completed')
      .reduce((total, movie) => {
        const runtime = movie.runtime || 120; // 默认120分钟
        return total + (runtime * (movie.watch_count || 1));
      }, 0);

    const avgRating = movies.value
      .filter(m => m.personal_rating)
      .reduce((sum, movie, _, arr) => sum + (movie.personal_rating || 0) / arr.length, 0);

    return {
      totalMovies: totalMovies.value,
      completedMovies: completedMovies.value,
      watchingMovies: watchingMovies.value,
      totalWatchTime,
      averageRating: avgRating
    };
  });

  // ==================== 操作方法 ====================
  
  /**
   * 设置加载状态
   */
  const setLoading = (loading: boolean, error?: string) => {
    loadingState.value = { loading, error };
  };
  
  /**
   * 获取影视作品列表
   */
  const fetchMovies = async (): Promise<ApiResponse<void>> => {
    try {
      setLoading(true);

      const response = await databaseAPI.getMovies();
      if (response.success && response.data) {
        movies.value = response.data;
        pagination.value.total = response.data.length;
        pagination.value.totalPages = Math.ceil(response.data.length / pagination.value.pageSize);
      } else {
        throw new Error(response.error || '获取电影列表失败');
      }

      return { success: true, data: undefined };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setLoading(false, errorMessage);
      console.error('获取电影失败:', err);
      return { success: false, error: errorMessage };
    }
  };
  
  /**
   * 获取影视作品详情
   */
  const fetchMovieDetail = async (id: string): Promise<ApiResponse<ParsedMovie | null>> => {
    try {
      setLoading(true);

      const response = await databaseAPI.getMovieById(id);
      if (response.success && response.data) {
        currentMovie.value = response.data;
        return { success: true, data: currentMovie.value };
      } else {
        throw new Error(response.error || '获取电影详情失败');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setLoading(false, errorMessage);
      console.error('获取电影详情失败:', err);
      return { success: false, error: errorMessage };
    }
  };
  
  /**
   * 添加影视作品
   */
  const addMovie = async (form: AddMovieForm): Promise<ApiResponse<string>> => {
    try {
      setLoading(true);

      // 获取TMDb详细信息
      let tmdbData;
      let tmdbResponse;
      try {
        if (form.type === 'movie') {
          tmdbResponse = await tmdbAPI.getMovieDetails(form.tmdb_id);
        } else {
          tmdbResponse = await tmdbAPI.getTVDetails(form.tmdb_id);
        }

        if (!tmdbResponse.success || !tmdbResponse.data) {
          throw new Error(tmdbResponse.error || 'TMDb API 调用失败');
        }

        tmdbData = tmdbResponse.data;
      } catch (error) {
        console.error('[MovieStore] TMDb数据获取失败:', error);
        throw new Error('获取影视作品详细信息失败: ' + (error instanceof Error ? error.message : error));
      }

      // 合并表单数据和TMDb数据
      const movieData = {
        title: tmdbData.title || tmdbData.name || '',
        original_title: tmdbData.original_title || tmdbData.original_name || '',
        year: tmdbData.release_date ? new Date(tmdbData.release_date).getFullYear() :
              (tmdbData.first_air_date ? new Date(tmdbData.first_air_date).getFullYear() : undefined),
        type: form.type,
        tmdb_id: form.tmdb_id,
        poster_path: tmdbData.poster_path,
        overview: tmdbData.overview,
        status: form.status,
        personal_rating: form.personal_rating,
        tmdb_rating: tmdbData.vote_average,
        notes: form.notes,
        watch_source: form.watch_source,
        current_episode: form.current_episode,
        current_season: form.current_season,
        total_episodes: tmdbData.number_of_episodes,
        total_seasons: tmdbData.number_of_seasons,
        seasons_data: form.seasons_data,
        air_status: tmdbData.status
      };

      // 添加到数据库
      const response = await databaseAPI.addMovie(movieData);
      if (!response.success) {
        console.error('[MovieStore] 数据库保存失败:', response.error);
        throw new Error(response.error || '添加影视作品失败');
      }

      // 刷新列表
      await fetchMovies();

      setLoading(false);
      return {
        success: true,
        data: response.data?.id || ''
      };
    } catch (err) {
      setLoading(false);
      const errorMessage = err instanceof Error ? err.message : '添加影视作品失败';
      console.error('[MovieStore] 添加电影失败:', errorMessage);
      return {
        success: false,
        error: errorMessage
      };
    }
  };
  
  /**
   * 更新影视作品
   */
  const updateMovie = async (form: UpdateMovieForm): Promise<ApiResponse<void>> => {
    try {
      setLoading(true);

      const response = await databaseAPI.updateMovie(form);
      if (response.success && response.data) {
        // 更新当前影视作品（如果正在查看）
        if (currentMovie.value?.id === form.id) {
          currentMovie.value = response.data;
        }

        // 刷新列表
        await fetchMovies();
        return { success: true, data: undefined };
      } else {
        throw new Error(response.error || '更新电影失败');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setLoading(false, errorMessage);
      console.error('更新电影失败:', err);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * 删除影视作品
   */
  const deleteMovie = async (id: string): Promise<ApiResponse<void>> => {
    try {
      setLoading(true);

      const response = await databaseAPI.deleteMovie(id);
      if (response.success) {
        // 如果删除的是当前查看的影视作品，清空当前影视作品
        if (currentMovie.value?.id === id) {
          currentMovie.value = null;
        }

        // 刷新列表
        await fetchMovies();
        return { success: true, data: undefined };
      } else {
        throw new Error(response.error || '删除电影失败');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setLoading(false, errorMessage);
      console.error('删除电影失败:', err);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * 搜索TMDb影视作品
   */
  const searchTMDb = async (query: string, mediaType?: 'movie' | 'tv'): Promise<ApiResponse<TMDbMovie[]>> => {
    try {
      if (!query.trim()) {
        searchResults.value = [];
        return { success: true, data: [] };
      }

      searchLoading.value = true;

      const response = await tmdbAPI.searchMulti(query, 1);
      if (response.success && response.data) {
        searchResults.value = response.data.results;
        return { success: true, data: searchResults.value };
      } else {
        throw new Error(response.error || 'TMDb搜索失败');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setLoading(false, errorMessage);
      console.error('TMDb搜索失败:', err);
      return { success: false, error: errorMessage };
    } finally {
      searchLoading.value = false;
    }
  };
  
  /**
   * 获取热门内容
   */
  const fetchPopularContent = async (): Promise<ApiResponse<void>> => {
    try {
      popularLoading.value = true;

      const [moviesResult, tvResult] = await Promise.all([
        tmdbAPI.getPopularMovies(),
        tmdbAPI.getPopularTV()
      ]);

      if (moviesResult.success && moviesResult.data) {
        popularMovies.value = moviesResult.data.results;
      }
      if (tvResult.success && tvResult.data) {
        popularTVShows.value = tvResult.data.results;
      }

      return { success: true, data: undefined };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setLoading(false, errorMessage);
      console.error('获取热门内容失败:', err);
      return { success: false, error: errorMessage };
    } finally {
      popularLoading.value = false;
    }
  };
  
  /**
   * 设置筛选条件
   */
  const setFilters = (newFilters: Partial<SearchFilters>) => {
    filters.value = { ...filters.value, ...newFilters };
    pagination.value.page = 1; // 重置页码
  };
  
  /**
   * 重置筛选条件
   */
  const resetFilters = () => {
    filters.value = {
      query: '',
      type: [],
      status: [],
      genres: [],
      sortBy: 'date_updated',
      sortOrder: 'desc'
    };
    pagination.value.page = 1;
  };
  
  /**
   * 设置页码
   */
  const setPage = (page: number) => {
    pagination.value.page = page;
  };
  
  /**
   * 设置每页大小
   */
  const setPageSize = (size: number) => {
    pagination.value.pageSize = size;
    pagination.value.page = 1; // 重置页码
  };
  
  /**
   * 设置视图模式
   */
  const setViewMode = (mode: ViewMode) => {
    viewMode.value = mode;
  };
  
  /**
   * 切换视图模式
   */
  const toggleViewMode = () => {
    const modes: ViewMode[] = ['grid', 'list', 'timeline'];
    const currentIndex = modes.indexOf(viewMode.value);
    const nextIndex = (currentIndex + 1) % modes.length;
    viewMode.value = modes[nextIndex];
  };
  
  /**
   * 清空搜索结果
   */
  const clearSearchResults = () => {
    searchResults.value = [];
  };
  
  /**
   * 获取TMDb影视作品详情
   */
  const fetchTMDbDetail = async (id: number, mediaType: 'movie' | 'tv'): Promise<ApiResponse<TMDbMovieDetail>> => {
    try {
      let response: ApiResponse<TMDbMovieDetail>;
      if (mediaType === 'movie') {
        response = await tmdbAPI.getMovieDetails(id);
      } else {
        response = await tmdbAPI.getTVDetails(id);
      }
      return response;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('获取TMDb详情失败:', err);
      return { success: false, error: errorMessage };
    }
  };
  
  /**
   * 按类型筛选影视作品
   */
  const filterByType = (type: MovieType) => {
    if (filters.value.type?.includes(type)) {
      filters.value.type = filters.value.type.filter(t => t !== type);
    } else {
      filters.value.type = [...(filters.value.type || []), type];
    }
    pagination.value.page = 1;
  };
  
  /**
   * 按状态筛选影视作品
   */
  const filterByStatus = (status: Status) => {
    if (filters.value.status?.includes(status)) {
      filters.value.status = filters.value.status.filter(s => s !== status);
    } else {
      filters.value.status = [...(filters.value.status || []), status];
    }
    pagination.value.page = 1;
  };
  
  // ==================== 观看历史相关方法 ====================
  
  /**
   * 获取观看历史
   * @param movieId 电影ID（可选）
   * @param limit 限制数量
   * @param offset 偏移量
   */
  const fetchReplayRecords = async (movieId?: string, limit?: number, offset?: number): Promise<ApiResponse<ReplayRecord[]>> => {
    try {
      setLoading(true);
      const response = await databaseAPI.getReplayRecords(movieId, limit, offset);
      
      if (response.success && response.data) {
        if (movieId) {
          // 如果是获取特定电影的观看历史，不更新全局状态
          return response;
        } else {
          // 更新全局观看历史状态
          replayRecords.value = response.data;
        }
      }
      
      setLoading(false);
      return response;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setLoading(false, errorMessage);
      console.error('获取观看历史失败:', err);
      return { success: false, error: errorMessage };
    }
  };
  
  /**
   * 获取特定电影的观看历史
   * @param movieId 电影ID
   */
  const getMovieReplayRecords = async (movieId: string): Promise<ApiResponse<ReplayRecord[]>> => {
    try {
      return await databaseAPI.getReplayRecords(movieId);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('获取电影观看历史失败:', err);
      return { success: false, error: errorMessage };
    }
  };
  
  /**
   * 更新电影记录时同步观看历史
   * @param movieId 电影ID
   * @param movieData 电影数据
   */
  const updateMovieWithHistory = async (movieId: string, movieData: UpdateMovieForm): Promise<ApiResponse<void>> => {
    try {
      setLoading(true);
      
      // 更新电影记录
      const updateResponse = await updateMovie(movieData);
      
      if (!updateResponse.success) {
        return updateResponse;
      }
      
      // 如果包含观看相关信息且已有重刷记录，同步到最新的观看历史
      if ((movieData.status === 'completed' || movieData.personal_rating) && movieData.personal_rating) {
        const existingHistoryResponse = await getMovieReplayRecords(movieId);
        
        if (existingHistoryResponse.success && existingHistoryResponse.data) {
          const existingHistory = existingHistoryResponse.data;
          
          if (existingHistory.length > 0) {
            // 仅更新最新的观看历史记录，不自动创建新记录
            const latestHistory = existingHistory[existingHistory.length - 1];
            await updateReplayRecord({
              ...latestHistory,
              rating: movieData.personal_rating,
              notes: movieData.notes,
              watch_source: movieData.watch_source
            });
          }
          // 移除自动创建重刷记录的逻辑
        }
      }
      
      setLoading(false);
      return { success: true, data: undefined };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setLoading(false, errorMessage);
      console.error('更新电影和观看历史失败:', err);
      return { success: false, error: errorMessage };
    }
  };
  
  /**
    * 添加重刷记录
    * @param replayRecordForm 重刷记录表单数据
    */
   const addReplayRecord = async (replayRecordForm: ReplayRecordForm): Promise<ApiResponse<ReplayRecord>> => {
    try {
      setLoading(true);
      const response = await databaseAPI.addReplayRecord(replayRecordForm);
      
      if (response.success && response.data) {
        // 更新本地观看历史状态
        replayRecords.value = [response.data, ...replayRecords.value];
        
        // 刷新电影列表以更新观看次数等信息
        await fetchMovies();
      }
      
      setLoading(false);
      return response;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setLoading(false, errorMessage);
      console.error('添加观看历史失败:', err);
      return { success: false, error: errorMessage };
    }
  };
  
  /**
    * 更新重刷记录
    * @param replayRecord 重刷记录数据
    */
   const updateReplayRecord = async (replayRecordData: ReplayRecord): Promise<ApiResponse<ReplayRecord>> => {
    try {
      setLoading(true);
      const response = await databaseAPI.updateReplayRecord(replayRecordData);
      
      if (response.success && response.data) {
        // 更新本地观看历史状态
        const index = replayRecords.value.findIndex(item => item.id === response.data.id);
        if (index !== -1) {
          replayRecords.value[index] = response.data;
        }
        
        // 刷新电影列表以更新相关信息
        await fetchMovies();
      }
      
      setLoading(false);
      return response;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setLoading(false, errorMessage);
      console.error('更新观看历史失败:', err);
      return { success: false, error: errorMessage };
    }
  };
  
  /**
   * 删除观看历史记录
   * @param id 观看历史ID
   */
  const deleteReplayRecord = async (id: string): Promise<ApiResponse<string>> => {
    try {
      setLoading(true);
      const response = await databaseAPI.deleteReplayRecord(id);
      
      if (response.success) {
        // 从本地状态中移除
        replayRecords.value = replayRecords.value.filter(item => item.id !== id);
        
        // 刷新电影列表以更新观看次数等信息
        await fetchMovies();
      }
      
      setLoading(false);
      return response;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setLoading(false, errorMessage);
      console.error('删除观看历史失败:', err);
      return { success: false, error: errorMessage };
    }
  };
  
  /**
   * 获取电影的观看次数
   * @param movieId 电影ID
   */
  const getWatchCount = async (movieId: string): Promise<number> => {
    try {
      const response = await databaseAPI.getWatchCount(movieId);
      return response.success ? response.data || 0 : 0;
    } catch (err) {
      console.error('获取观看次数失败:', err);
      return 0;
    }
  };
  
  /**
   * 获取观看历史详情
   * @param id 观看历史ID
   */
  const getReplayRecordById = async (id: string): Promise<ApiResponse<ReplayRecord | null>> => {
    try {
      return await databaseAPI.getReplayRecordById(id);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('获取观看历史详情失败:', err);
      return { success: false, error: errorMessage };
    }
  };
  
  /**
   * 清理错误信息
   */
  const clearError = () => {
    setLoading(false);
  };
  
  /**
   * 重置Store
   */
  const resetStore = () => {
    movies.value = [];
    currentMovie.value = null;
    searchResults.value = [];
    popularMovies.value = [];
    popularTVShows.value = [];
    filters.value = {
      query: '',
      type: [],
      status: [],
      genres: [],
      sortBy: 'date_updated',
      sortOrder: 'desc'
    };
    pagination.value = {
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 0
    };
    viewMode.value = 'grid';
    loadingState.value = { loading: false, error: undefined };
    searchLoading.value = false;
    popularLoading.value = false;
    replayRecords.value = [];
  };

  // ==================== 导出 ====================
  
  return {
    // 状态
    movies,
    currentMovie,
    searchResults,
    popularMovies,
    popularTVShows,
    filters,
    pagination,
    viewMode,
    loadingState,
    searchLoading,
    popularLoading,
    replayRecords,
    
    // 计算属性
    filteredCount,
    hasMovies,
    isLoading,
    error,
    pageInfo,
    moviesByStatus,
    totalMovies,
    completedMovies,
    watchingMovies,
    statistics,
    
    // 方法
    fetchMovies,
    fetchMovieDetail,
    addMovie,
    updateMovie,
    deleteMovie,
    searchTMDb,
    fetchPopularContent,
    setFilters,
    resetFilters,
    setPage,
    setPageSize,
    setViewMode,
    toggleViewMode,
    clearSearchResults,
    fetchTMDbDetail,
    filterByType,
    filterByStatus,
    fetchReplayRecords,
    addReplayRecord,
    updateReplayRecord,
    deleteReplayRecord,
    getWatchCount,
    getReplayRecordById,
    getMovieReplayRecords,
    updateMovieWithHistory,
    clearError,
    resetStore
  };
});