// API Configuration
const API_BASE_URL = '/api/v1';
const ENDPOINTS = {
    NEWS: `${API_BASE_URL}/get-news`,
    QUESTION: `${API_BASE_URL}/ask-question`,
    HEALTH: `${API_BASE_URL}/health`
};

// DOM Elements
const elements = {
    // Input elements
    newsQuery: document.getElementById('newsQuery'),
    searchBtn: document.getElementById('searchBtn'),
    questionInput: document.getElementById('questionInput'),
    askBtn: document.getElementById('askBtn'),
    
    // Display elements
    welcomeMessage: document.getElementById('welcomeMessage'),
    newsContainer: document.getElementById('newsContainer'),
    answerContainer: document.getElementById('answerContainer'),
    loadingSpinner: document.getElementById('loadingSpinner'),
    
    // Status elements
    statusDot: document.getElementById('statusDot'),
    statusText: document.getElementById('statusText'),
    footerStatus: document.getElementById('footerStatus'),
    totalArticles: document.getElementById('totalArticles'),
    lastUpdated: document.getElementById('lastUpdated'),
    
    // Modal elements
    errorModal: document.getElementById('errorModal'),
    errorMessage: document.getElementById('errorMessage'),
    closeModal: document.getElementById('closeModal')
};

// Application State
const appState = {
    isLoading: false,
    hasArticles: false,
    lastQuery: '',
    articles: [],
    currentAnswer: null
};

// Utility Functions
const utils = {
    formatDate: (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    },
    
    formatTimeAgo: (dateString) => {
        const now = new Date();
        const date = new Date(dateString);
        const diffInMinutes = Math.floor((now - date) / (1000 * 60));
        
        if (diffInMinutes < 1) return 'Just now';
        if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
        
        const diffInHours = Math.floor(diffInMinutes / 60);
        if (diffInHours < 24) return `${diffInHours}h ago`;
        
        const diffInDays = Math.floor(diffInHours / 24);
        return `${diffInDays}d ago`;
    },
    
    truncateText: (text, maxLength = 150) => {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    },
    
    sanitizeHTML: (str) => {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },
    
    isValidUrl: (string) => {
        try {
            const url = new URL(string);
            return url.protocol === 'http:' || url.protocol === 'https:';
        } catch (_) {
            return false;
        }
    },
    
    showNotification: (message, type = 'info') => {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
                <span>${utils.sanitizeHTML(message)}</span>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Show notification
        setTimeout(() => notification.classList.add('show'), 100);
        
        // Remove notification after 4 seconds
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => document.body.removeChild(notification), 300);
        }, 4000);
    }
};

// Status Management
const statusManager = {
    setStatus: (status, text) => {
        const statusClasses = ['loading', 'error'];
        elements.statusDot.classList.remove(...statusClasses);
        
        if (status !== 'ready') {
            elements.statusDot.classList.add(status);
        }
        
        elements.statusText.textContent = text;
        elements.footerStatus.textContent = text;
    },
    
    setReady: () => statusManager.setStatus('ready', 'Ready'),
    setLoading: (text = 'Processing...') => statusManager.setStatus('loading', text),
    setError: (text = 'Error occurred') => statusManager.setStatus('error', text)
};

// Loading Management
const loadingManager = {
    show: (buttonElement, text = 'Loading...') => {
        appState.isLoading = true;
        elements.loadingSpinner.classList.add('show');
        
        if (buttonElement) {
            buttonElement.disabled = true;
            buttonElement.classList.add('loading');
            buttonElement.setAttribute('data-original-text', buttonElement.innerHTML);
            buttonElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ' + text;
        }
        
        statusManager.setLoading(text);
    },
    
    hide: (buttonElement) => {
        appState.isLoading = false;
        elements.loadingSpinner.classList.remove('show');
        
        if (buttonElement) {
            buttonElement.disabled = false;
            buttonElement.classList.remove('loading');
            const originalText = buttonElement.getAttribute('data-original-text');
            if (originalText) {
                buttonElement.innerHTML = originalText;
                buttonElement.removeAttribute('data-original-text');
            }
        }
        
        statusManager.setReady();
    }
};

// Error Handling
const errorHandler = {
    show: (message, title = 'Error') => {
        elements.errorMessage.innerHTML = utils.sanitizeHTML(message);
        elements.errorModal.classList.add('show');
        statusManager.setError('Error occurred');
    },
    
    hide: () => {
        elements.errorModal.classList.remove('show');
        statusManager.setReady();
    },
    
    handleApiError: (error, defaultMessage = 'An unexpected error occurred') => {
        console.error('API Error:', error);
        
        let message = defaultMessage;
        
        if (error.response) {
            // Server responded with error status
            const data = error.response.data || {};
            message = data.detail || data.message || `Server error: ${error.response.status}`;
        } else if (error.request) {
            // Network error
            message = 'Network error. Please check your connection and try again.';
        } else if (error.message) {
            // Other error
            message = error.message;
        }
        
        errorHandler.show(message);
        utils.showNotification(message, 'error');
    }
};

// API Functions
const apiClient = {
    async makeRequest(url, options = {}) {
        try {
            const response = await fetch(url, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw {
                    response: {
                        status: response.status,
                        data: data
                    }
                };
            }
            
            return data;
        } catch (error) {
            throw error;
        }
    },
    
    async fetchNews(query) {
        return await this.makeRequest(ENDPOINTS.NEWS, {
            method: 'POST',
            body: JSON.stringify({ query })
        });
    },
    
    async askQuestion(question) {
        return await this.makeRequest(ENDPOINTS.QUESTION, {
            method: 'POST',
            body: JSON.stringify({ question })
        });
    },
    
    async checkHealth() {
        return await this.makeRequest(ENDPOINTS.HEALTH);
    }
};

// News Display Functions
const newsDisplay = {
    hideWelcome: () => {
        elements.welcomeMessage.style.display = 'none';
        elements.newsContainer.style.display = 'block';
    },
    
    showWelcome: () => {
        elements.welcomeMessage.style.display = 'block';
        elements.newsContainer.style.display = 'none';
        elements.answerContainer.style.display = 'none';
    },
    
    renderArticles: (articles) => {
        if (!articles || articles.length === 0) {
            elements.newsContainer.innerHTML = `
                <div class="no-results">
                    <div class="welcome-icon">
                        <i class="fas fa-search"></i>
                    </div>
                    <h3>No articles found</h3>
                    <p>Try a different search query or date range.</p>
                </div>
            `;
            return;
        }
        
        const articlesHtml = articles.map((article, index) => {
            // Check if the article has a valid URL
            const hasValidUrl = article.url && utils.isValidUrl(article.url);
            const linkText = hasValidUrl ? 'Read Full Article' : 'Link Not Available';
            const linkClass = hasValidUrl ? 'article-link' : 'article-link disabled';
            const linkAttributes = hasValidUrl 
                ? `href="${article.url}" target="_blank" rel="noopener noreferrer"` 
                : 'href="#" onclick="return false;" title="Original article link is not available"';
            
            return `
                <article class="news-article" data-index="${index}">
                    <div class="article-header">
                        <div>
                            <h3 class="article-title">${utils.sanitizeHTML(article.title || 'Untitled')}</h3>
                            <div class="article-meta">
                                <span><i class="fas fa-calendar"></i> ${article.published_date ? utils.formatDate(article.published_date) : 'Unknown date'}</span>
                                <span><i class="fas fa-globe"></i> ${utils.sanitizeHTML(article.source || 'Unknown source')}</span>
                                ${article.author ? `<span><i class="fas fa-user"></i> ${utils.sanitizeHTML(article.author)}</span>` : ''}
                            </div>
                        </div>
                    </div>
                    <div class="article-summary">
                        ${utils.sanitizeHTML(article.summary || article.description || 'No summary available')}
                    </div>
                    <div class="article-actions">
                        <a ${linkAttributes} class="${linkClass}">
                            <i class="fas ${hasValidUrl ? 'fa-external-link-alt' : 'fa-ban'}"></i>
                            ${linkText}
                        </a>
                        <button class="bookmark-btn" data-index="${index}" title="Bookmark this article">
                            <i class="fas fa-bookmark"></i>
                        </button>
                    </div>
                </article>
            `;
        }).join('');
        
        elements.newsContainer.innerHTML = articlesHtml;
        newsDisplay.hideWelcome();
        
        // Add event listeners for bookmark buttons
        document.querySelectorAll('.bookmark-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.currentTarget.getAttribute('data-index'));
                newsDisplay.toggleBookmark(index, e.currentTarget);
            });
        });

        // Add event listeners for disabled links to show notification
        document.querySelectorAll('.article-link.disabled').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                utils.showNotification('Original article link is not available for this news item', 'info');
                return false;
            });
        });
    },
    
    toggleBookmark: (index, buttonElement) => {
        const article = appState.articles[index];
        if (!article) return;
        
        // Use a fallback identifier if URL is not available
        const articleId = article.url || `${article.title}-${article.source}`;
        
        const bookmarks = JSON.parse(localStorage.getItem('ai-news-bookmarks') || '[]');
        const existingIndex = bookmarks.findIndex(b => (b.url && b.url === article.url) || (b.id && b.id === articleId));
        
        if (existingIndex >= 0) {
            // Remove bookmark
            bookmarks.splice(existingIndex, 1);
            buttonElement.classList.remove('bookmarked');
            buttonElement.title = 'Bookmark this article';
            utils.showNotification('Bookmark removed', 'info');
        } else {
            // Add bookmark
            bookmarks.push({
                id: articleId,
                title: article.title,
                url: article.url || null,
                source: article.source,
                summary: article.summary,
                bookmarked_at: new Date().toISOString()
            });
            buttonElement.classList.add('bookmarked');
            buttonElement.title = 'Remove bookmark';
            utils.showNotification('Article bookmarked', 'success');
        }
        
        localStorage.setItem('ai-news-bookmarks', JSON.stringify(bookmarks));
    },
    
    updateStats: (totalArticles, lastUpdated) => {
        elements.totalArticles.textContent = totalArticles;
        elements.lastUpdated.textContent = utils.formatTimeAgo(lastUpdated);
    }
};

// Answer Display Functions
const answerDisplay = {
    show: (answer, sources = []) => {
        elements.answerContainer.style.display = 'block';
        
        const sourcesHtml = sources.length > 0 ? `
            <div class="sources-section">
                <div class="sources-title">
                    <i class="fas fa-link"></i> Sources (${sources.length})
                </div>
                ${sources.map((source, index) => {
                    const hasValidUrl = source.url && utils.isValidUrl(source.url);
                    return `
                        <div class="source-item" data-source-index="${index}">
                            <div class="source-content">
                                <div class="source-title">${utils.sanitizeHTML(source.title || 'Untitled')}</div>
                                <div class="source-meta">
                                    <span><i class="fas fa-globe"></i> ${utils.sanitizeHTML(source.source || 'Unknown source')}</span>
                                    ${hasValidUrl 
                                        ? `<a href="${source.url}" target="_blank" rel="noopener noreferrer" class="source-link" title="Open source article"><i class="fas fa-external-link-alt"></i></a>` 
                                        : `<span class="source-link disabled" title="Source link not available"><i class="fas fa-ban"></i></span>`
                                    }
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        ` : '';
        
        elements.answerContainer.innerHTML = `
            <div class="answer-header">
                <i class="fas fa-comment-dots"></i>
                AI Answer
                <button class="copy-answer-btn" title="Copy answer to clipboard">
                    <i class="fas fa-copy"></i>
                </button>
            </div>
            <div class="answer-content">
                <div class="answer-text">${utils.sanitizeHTML(answer)}</div>
                ${sourcesHtml}
            </div>
        `;
        
        // Add copy functionality
        const copyBtn = elements.answerContainer.querySelector('.copy-answer-btn');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => answerDisplay.copyAnswer(answer));
        }
        
        // Scroll to answer
        elements.answerContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    },
    
    hide: () => {
        elements.answerContainer.style.display = 'none';
    },
    
    copyAnswer: async (answer) => {
        try {
            await navigator.clipboard.writeText(answer);
            utils.showNotification('Answer copied to clipboard', 'success');
        } catch (error) {
            console.error('Failed to copy:', error);
            utils.showNotification('Failed to copy answer', 'error');
        }
    }
};

// Search Functions
const searchManager = {
    async performSearch(query) {
        if (!query.trim()) {
            errorHandler.show('Please enter a search query.');
            return;
        }
        
        if (appState.isLoading) return;
        
        try {
            loadingManager.show(elements.searchBtn, 'Searching...');
            answerDisplay.hide();
            
            const response = await apiClient.fetchNews(query);
            
            if (response.articles && response.articles.length > 0) {
                appState.articles = response.articles;
                appState.hasArticles = true;
                appState.lastQuery = query;
                
                newsDisplay.renderArticles(response.articles);
                newsDisplay.updateStats(response.total_count, response.processed_at);
                
                // Enable question input
                elements.questionInput.disabled = false;
                elements.askBtn.disabled = false;
                elements.questionInput.placeholder = 'Ask questions about the news articles...';
                
                // Show success message
                utils.showNotification(`Found ${response.total_count} articles`, 'success');
                statusManager.setStatus('ready', `Found ${response.total_count} articles`);
                
                // Save recent search
                searchManager.saveRecentSearch(query);
                
            } else {
                newsDisplay.renderArticles([]);
                utils.showNotification('No articles found for your search', 'info');
                statusManager.setStatus('ready', 'No articles found');
            }
            
        } catch (error) {
            errorHandler.handleApiError(error, 'Failed to fetch news articles');
        } finally {
            loadingManager.hide(elements.searchBtn);
        }
    },
    
    saveRecentSearch: (query) => {
        const recentSearches = JSON.parse(localStorage.getItem('ai-news-recent-searches') || '[]');
        
        // Remove if already exists
        const existingIndex = recentSearches.findIndex(search => search.query === query);
        if (existingIndex >= 0) {
            recentSearches.splice(existingIndex, 1);
        }
        
        // Add to beginning
        recentSearches.unshift({
            query: query,
            timestamp: new Date().toISOString()
        });
        
        // Keep only last 10 searches
        const trimmedSearches = recentSearches.slice(0, 10);
        localStorage.setItem('ai-news-recent-searches', JSON.stringify(trimmedSearches));
    },
    
    loadRecentSearches: () => {
        const recentSearches = JSON.parse(localStorage.getItem('ai-news-recent-searches') || '[]');
        return recentSearches;
    }
};

// Question Functions
const questionManager = {
    async askQuestion(question) {
        if (!question.trim()) {
            errorHandler.show('Please enter a question.');
            return;
        }
        
        if (!appState.hasArticles) {
            errorHandler.show('Please search for news articles first.');
            return;
        }
        
        if (appState.isLoading) return;
        
        try {
            loadingManager.show(elements.askBtn, 'Thinking...');
            
            const response = await apiClient.askQuestion(question);
            
            if (response.answer) {
                answerDisplay.show(response.answer, response.sources || []);
                appState.currentAnswer = response;
                
                // Clear the question input
                elements.questionInput.value = '';
                
                // Save question history
                questionManager.saveQuestionHistory(question, response.answer);
                
                utils.showNotification('Question answered successfully', 'success');
                statusManager.setStatus('ready', 'Question answered');
            } else {
                errorHandler.show('No answer received. Please try a different question.');
                utils.showNotification('No answer received', 'error');
            }
            
        } catch (error) {
            errorHandler.handleApiError(error, 'Failed to get answer');
        } finally {
            loadingManager.hide(elements.askBtn);
        }
    },
    
    saveQuestionHistory: (question, answer) => {
        const history = JSON.parse(localStorage.getItem('ai-news-question-history') || '[]');
        
        history.unshift({
            question: question,
            answer: answer,
            timestamp: new Date().toISOString(),
            query: appState.lastQuery
        });
        
        // Keep only last 20 Q&As
        const trimmedHistory = history.slice(0, 20);
        localStorage.setItem('ai-news-question-history', JSON.stringify(trimmedHistory));
    }
};

// Keyboard Shortcuts
const keyboardManager = {
    init: () => {
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + K to focus search
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                elements.newsQuery.focus();
                elements.newsQuery.select();
            }
            
            // Ctrl/Cmd + Enter to search
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                if (document.activeElement === elements.newsQuery) {
                    searchManager.performSearch(elements.newsQuery.value);
                } else if (document.activeElement === elements.questionInput) {
                    questionManager.askQuestion(elements.questionInput.value);
                }
            }
            
            // Escape to close modal or clear inputs
            if (e.key === 'Escape') {
                if (elements.errorModal.classList.contains('show')) {
                    errorHandler.hide();
                } else if (document.activeElement === elements.newsQuery) {
                    elements.newsQuery.blur();
                } else if (document.activeElement === elements.questionInput) {
                    elements.questionInput.blur();
                }
            }
        });
    }
};

// Event Listeners
const eventListeners = {
    init: () => {
        // Search functionality
        elements.searchBtn.addEventListener('click', () => {
            const query = elements.newsQuery.value;
            searchManager.performSearch(query);
        });
        
        elements.newsQuery.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !appState.isLoading) {
                const query = elements.newsQuery.value;
                searchManager.performSearch(query);
            }
        });
        
        // Question functionality
        elements.askBtn.addEventListener('click', () => {
            const question = elements.questionInput.value;
            questionManager.askQuestion(question);
        });
        
        elements.questionInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !appState.isLoading) {
                const question = elements.questionInput.value;
                questionManager.askQuestion(question);
            }
        });
        
        // Quick action buttons
        document.querySelectorAll('.quick-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const query = e.target.getAttribute('data-query');
                elements.newsQuery.value = query;
                searchManager.performSearch(query);
            });
        });
        
        // Modal functionality
        elements.closeModal.addEventListener('click', errorHandler.hide);
        elements.errorModal.addEventListener('click', (e) => {
            if (e.target === elements.errorModal) {
                errorHandler.hide();
            }
        });
        
        // Input enhancements
        elements.newsQuery.addEventListener('input', (e) => {
            // Auto-save draft
            localStorage.setItem('ai-news-draft-query', e.target.value);
        });
        
        elements.questionInput.addEventListener('input', (e) => {
            // Auto-save draft
            localStorage.setItem('ai-news-draft-question', e.target.value);
        });
        
        // Load drafts on page load
        const draftQuery = localStorage.getItem('ai-news-draft-query');
        const draftQuestion = localStorage.getItem('ai-news-draft-question');
        
        if (draftQuery) {
            elements.newsQuery.value = draftQuery;
        }
        
        if (draftQuestion) {
            elements.questionInput.value = draftQuestion;
        }
    }
};

// Health Check
const healthCheck = {
    async check() {
        try {
            await apiClient.checkHealth();
            statusManager.setReady();
            return true;
        } catch (error) {
            console.error('Health check failed:', error);
            statusManager.setError('Server unavailable');
            return false;
        }
    },
    
    startPeriodicCheck() {
        // Check health every 30 seconds
        setInterval(async () => {
            if (!appState.isLoading) {
                await healthCheck.check();
            }
        }, 30 * 1000);
    }
};

// Theme Manager
const themeManager = {
    init: () => {
        // Add dynamic background effects
        const createParticles = () => {
            const particlesContainer = document.createElement('div');
            particlesContainer.className = 'particles-container';
            particlesContainer.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                pointer-events: none;
                z-index: -1;
                overflow: hidden;
            `;
            
            for (let i = 0; i < 20; i++) {
                const particle = document.createElement('div');
                particle.className = 'particle';
                particle.style.cssText = `
                    position: absolute;
                    width: 2px;
                    height: 2px;
                    background: rgba(59, 130, 246, 0.3);
                    border-radius: 50%;
                    animation: float ${10 + Math.random() * 20}s infinite linear;
                    left: ${Math.random() * 100}%;
                    top: ${Math.random() * 100}%;
                    animation-delay: ${Math.random() * 20}s;
                `;
                particlesContainer.appendChild(particle);
            }
            
            document.body.appendChild(particlesContainer);
        };
        
        // Add CSS for particle animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes float {
                0% { transform: translateY(0px) rotate(0deg); opacity: 0; }
                10% { opacity: 1; }
                90% { opacity: 1; }
                100% { transform: translateY(-100vh) rotate(360deg); opacity: 0; }
            }
            
            .notification {
                position: fixed;
                top: 20px;
                right: -400px;
                background: rgba(15, 23, 42, 0.95);
                border: 1px solid rgba(59, 130, 246, 0.3);
                border-radius: 12px;
                padding: 1rem;
                color: #e2e8f0;
                z-index: 1001;
                transition: right 0.3s ease;
                backdrop-filter: blur(20px);
                box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
            }
            
            .notification.show {
                right: 20px;
            }
            
            .notification-content {
                display: flex;
                align-items: center;
                gap: 0.75rem;
            }
            
            .notification-success i { color: #10b981; }
            .notification-error i { color: #ef4444; }
            .notification-info i { color: #3b82f6; }
            
            .bookmark-btn {
                background: none;
                border: 1px solid rgba(59, 130, 246, 0.3);
                color: #64748b;
                padding: 0.5rem;
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.3s ease;
            }
            
            .bookmark-btn:hover {
                color: #3b82f6;
                border-color: #3b82f6;
            }
            
            .bookmark-btn.bookmarked {
                color: #f59e0b;
                border-color: #f59e0b;
            }
            
            .article-actions {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-top: 1rem;
            }
            
            .copy-answer-btn {
                background: none;
                border: 1px solid rgba(59, 130, 246, 0.3);
                color: #64748b;
                padding: 0.5rem;
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.3s ease;
            }
            
            .copy-answer-btn:hover {
                color: #3b82f6;
                border-color: #3b82f6;
            }
            
            .article-link.disabled {
                color: #64748b;
                cursor: not-allowed;
                opacity: 0.6;
                text-decoration: none;
            }
            
            .article-link.disabled:hover {
                color: #64748b;
                text-decoration: none;
            }
            
            .source-link.disabled {
                color: #64748b;
                cursor: not-allowed;
                opacity: 0.6;
            }
        `;
        document.head.appendChild(style);
        
        // Create particles effect
        createParticles();
    }
};

// Initialize Application
const app = {
    init: async () => {
        console.log('🚀 Initializing AI News Agent...');
        
        try {
            // Initialize theme
            themeManager.init();
            
            // Initialize keyboard shortcuts
            keyboardManager.init();
            
            // Initialize event listeners
            eventListeners.init();
            
            // Perform initial health check
            const isHealthy = await healthCheck.check();
            
            if (isHealthy) {
                // Start periodic health checks
                healthCheck.startPeriodicCheck();
                
                // Set initial focus
                elements.newsQuery.focus();
                
                console.log('✅ AI News Agent initialized successfully!');
                utils.showNotification('AI News Agent is ready!', 'success');
            } else {
                console.warn('⚠️ AI News Agent started with server issues');
                utils.showNotification('Server connection issues detected', 'error');
            }
            
            // Set initial state
            statusManager.setReady();
            
        } catch (error) {
            console.error('❌ Failed to initialize AI News Agent:', error);
            statusManager.setError('Initialization failed');
            utils.showNotification('Failed to initialize application', 'error');
        }
    }
};

// Start the application when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', app.init);
} else {
    app.init();
}

// Global error handler
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    statusManager.setError('Application error');
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    statusManager.setError('Application error');
});

// Export for debugging (in development)
if (typeof window !== 'undefined') {
    window.aiNewsAgent = {
        appState,
        searchManager,
        questionManager,
        apiClient,
        utils
    };
}