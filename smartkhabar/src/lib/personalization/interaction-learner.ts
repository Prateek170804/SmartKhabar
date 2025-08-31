import { UserPreferences, UserInteraction } from '@/types';
import { supabase, TABLES } from '@/lib/supabase';

export class InteractionLearnerError extends Error {
    constructor(message: string, public code?: string) {
        super(message);
        this.name = 'InteractionLearnerError';
    }
}

export interface InteractionLearnerConfig {
    learningRate: number;
    decayFactor: number;
    minInteractionsForLearning: number;
    maxInteractionHistory: number;
    positiveActions: string[];
    negativeActions: string[];
    categoryLearningEnabled: boolean;
    sourceLearningEnabled: boolean;
    topicLearningEnabled: boolean;
}

export const DEFAULT_INTERACTION_LEARNER_CONFIG: InteractionLearnerConfig = {
    learningRate: 0.1,
    decayFactor: 0.95,
    minInteractionsForLearning: 5,
    maxInteractionHistory: 1000,
    positiveActions: ['read_more', 'like', 'share'],
    negativeActions: ['hide'],
    categoryLearningEnabled: true,
    sourceLearningEnabled: true,
    topicLearningEnabled: true,
};

export interface InteractionStats {
    item: string;
    totalInteractions: number;
    positiveInteractions: number;
    negativeInteractions: number;
    positiveRatio: number;
    lastInteraction: Date;
    trend: 'increasing' | 'decreasing' | 'stable';
}

export interface LearningInsights {
    userId: string;
    totalInteractions: number;
    learningConfidence: number;
    topCategories: InteractionStats[];
    topSources: InteractionStats[];
    emergingTopics: string[];
    decliningSources: string[];
    recommendedPreferenceUpdates: Partial<UserPreferences>;
    lastAnalyzed: Date;
}

export interface PreferenceUpdateResult {
    updatedPreferences: UserPreferences;
    changes: Array<{
        field: keyof UserPreferences;
        oldValue: any;
        newValue: any;
        reason: string;
        confidence: number;
    }>;
    learningInsights: LearningInsights;
}

export class InteractionLearner {
    private config: InteractionLearnerConfig;

    constructor(config: Partial<InteractionLearnerConfig> = {}) {
        this.config = { ...DEFAULT_INTERACTION_LEARNER_CONFIG, ...config };
    }

    async trackInteraction(interaction: UserInteraction): Promise<void> {
        try {
            const { error } = await supabase
                .from(TABLES.USER_INTERACTIONS)
                .insert({
                    userId: interaction.userId,
                    articleId: interaction.articleId,
                    action: interaction.action,
                    timestamp: interaction.timestamp.toISOString(),
                });

            if (error) {
                throw new InteractionLearnerError(`Failed to track interaction: ${error.message}`);
            }

            await this.cleanupOldInteractions(interaction.userId);
        } catch (error) {
            if (error instanceof InteractionLearnerError) {
                throw error;
            }
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            throw new InteractionLearnerError(`Failed to track interaction: ${errorMessage}`);
        }
    }

    async analyzeInteractions(userId: string): Promise<LearningInsights> {
        try {
            const { data: interactions, error } = await supabase
                .from(TABLES.USER_INTERACTIONS)
                .select(`
          *,
          articles:articleId (
            source,
            category,
            tags
          )
        `)
                .eq('userId', userId)
                .order('timestamp', { ascending: false })
                .limit(this.config.maxInteractionHistory);

            if (error) {
                throw new InteractionLearnerError(`Failed to fetch interactions: ${error.message}`);
            }

            if (!interactions || interactions.length < this.config.minInteractionsForLearning) {
                return this.createEmptyInsights(userId);
            }

            const categoryStats = this.analyzeItemInteractions(
                interactions,
                'category',
                (item: any) => item.articles?.category
            );

            const sourceStats = this.analyzeItemInteractions(
                interactions,
                'source',
                (item: any) => item.articles?.source
            );

            const emergingTopics = this.extractEmergingTopics(interactions);
            const decliningSources = this.identifyDecliningItems(sourceStats);
            const learningConfidence = this.calculateLearningConfidence(interactions.length);
            const recommendedPreferenceUpdates = await this.generatePreferenceRecommendations(
                userId,
                categoryStats,
                sourceStats,
                emergingTopics
            );

            return {
                userId,
                totalInteractions: interactions.length,
                learningConfidence,
                topCategories: categoryStats.slice(0, 10),
                topSources: sourceStats.slice(0, 10),
                emergingTopics,
                decliningSources,
                recommendedPreferenceUpdates,
                lastAnalyzed: new Date(),
            };
        } catch (error) {
            if (error instanceof InteractionLearnerError) {
                throw error;
            }
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            throw new InteractionLearnerError(`Failed to analyze interactions: ${errorMessage}`);
        }
    }

    async updatePreferencesFromInteractions(
        userId: string,
        currentPreferences: UserPreferences
    ): Promise<PreferenceUpdateResult> {
        try {
            const insights = await this.analyzeInteractions(userId);

            if (insights.learningConfidence < 0.3) {
                return {
                    updatedPreferences: currentPreferences,
                    changes: [],
                    learningInsights: insights,
                };
            }

            const changes: PreferenceUpdateResult['changes'] = [];
            const updatedPreferences = { ...currentPreferences };

            if (this.config.topicLearningEnabled && insights.emergingTopics.length > 0) {
                const newTopics = this.mergeTopics(
                    currentPreferences.topics,
                    insights.emergingTopics,
                    insights.learningConfidence
                );

                if (JSON.stringify(newTopics) !== JSON.stringify(currentPreferences.topics)) {
                    changes.push({
                        field: 'topics',
                        oldValue: currentPreferences.topics,
                        newValue: newTopics,
                        reason: 'Added emerging topics based on interaction patterns',
                        confidence: insights.learningConfidence,
                    });
                    updatedPreferences.topics = newTopics;
                }
            }

            if (this.config.sourceLearningEnabled) {
                const newPreferredSources = this.updatePreferredSources(
                    currentPreferences.preferredSources || [],
                    insights.topSources,
                    insights.learningConfidence
                );

                if (JSON.stringify(newPreferredSources) !== JSON.stringify(currentPreferences.preferredSources)) {
                    changes.push({
                        field: 'preferredSources',
                        oldValue: currentPreferences.preferredSources,
                        newValue: newPreferredSources,
                        reason: 'Updated based on positive source interactions',
                        confidence: insights.learningConfidence,
                    });
                    updatedPreferences.preferredSources = newPreferredSources;
                }
            }

            if (this.config.sourceLearningEnabled && insights.decliningSources.length > 0) {
                const newExcludedSources = this.updateExcludedSources(
                    currentPreferences.excludedSources || [],
                    insights.decliningSources,
                    insights.learningConfidence
                );

                if (JSON.stringify(newExcludedSources) !== JSON.stringify(currentPreferences.excludedSources)) {
                    changes.push({
                        field: 'excludedSources',
                        oldValue: currentPreferences.excludedSources,
                        newValue: newExcludedSources,
                        reason: 'Added sources with consistently negative interactions',
                        confidence: insights.learningConfidence,
                    });
                    updatedPreferences.excludedSources = newExcludedSources;
                }
            }

            updatedPreferences.lastUpdated = new Date();

            return {
                updatedPreferences,
                changes,
                learningInsights: insights,
            };
        } catch (error) {
            if (error instanceof InteractionLearnerError) {
                throw error;
            }
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            throw new InteractionLearnerError(`Failed to update preferences: ${errorMessage}`);
        }
    }

    async getUserInteractionStats(userId: string): Promise<{
        totalInteractions: number;
        recentInteractions: number;
        topActions: Array<{ action: string; count: number }>;
        activityTrend: 'increasing' | 'decreasing' | 'stable';
    }> {
        try {
            const { data: interactions, error } = await supabase
                .from(TABLES.USER_INTERACTIONS)
                .select('action, timestamp')
                .eq('userId', userId)
                .order('timestamp', { ascending: false });

            if (error) {
                throw new InteractionLearnerError(`Failed to fetch interaction stats: ${error.message}`);
            }

            if (!interactions) {
                return {
                    totalInteractions: 0,
                    recentInteractions: 0,
                    topActions: [],
                    activityTrend: 'stable',
                };
            }

            const now = new Date();
            const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

            const recentInteractions = interactions.filter(
                i => new Date(i.timestamp) >= sevenDaysAgo
            ).length;

            const previousWeekInteractions = interactions.filter(
                i => new Date(i.timestamp) >= fourteenDaysAgo && new Date(i.timestamp) < sevenDaysAgo
            ).length;

            let activityTrend: 'increasing' | 'decreasing' | 'stable' = 'stable';
            if (recentInteractions > previousWeekInteractions * 1.2) {
                activityTrend = 'increasing';
            } else if (recentInteractions < previousWeekInteractions * 0.8) {
                activityTrend = 'decreasing';
            }

            const actionCounts = new Map<string, number>();
            for (const interaction of interactions) {
                actionCounts.set(interaction.action, (actionCounts.get(interaction.action) || 0) + 1);
            }

            const topActions = Array.from(actionCounts.entries())
                .map(([action, count]) => ({ action, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 5);

            return {
                totalInteractions: interactions.length,
                recentInteractions,
                topActions,
                activityTrend,
            };
        } catch (error) {
            if (error instanceof InteractionLearnerError) {
                throw error;
            }
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            throw new InteractionLearnerError(`Failed to get interaction stats: ${errorMessage}`);
        }
    }

    async resetUserLearning(userId: string): Promise<void> {
        try {
            const { error } = await supabase
                .from(TABLES.USER_INTERACTIONS)
                .delete()
                .eq('userId', userId);

            if (error) {
                throw new InteractionLearnerError(`Failed to reset learning data: ${error.message}`);
            }
        } catch (error) {
            if (error instanceof InteractionLearnerError) {
                throw error;
            }
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            throw new InteractionLearnerError(`Failed to reset learning data: ${errorMessage}`);
        }
    }

    updateConfig(newConfig: Partial<InteractionLearnerConfig>): void {
        this.config = { ...this.config, ...newConfig };
    }

    getConfig(): InteractionLearnerConfig {
        return { ...this.config };
    }

    private async cleanupOldInteractions(userId: string): Promise<void> {
        try {
            const { data: interactions, error: fetchError } = await supabase
                .from(TABLES.USER_INTERACTIONS)
                .select('userId, timestamp')
                .eq('userId', userId)
                .order('timestamp', { ascending: false });

            if (fetchError) {
                throw new Error(`Failed to fetch interactions for cleanup: ${fetchError.message}`);
            }

            if (!interactions || interactions.length <= this.config.maxInteractionHistory) {
                return;
            }

            const cutoffTimestamp = interactions[this.config.maxInteractionHistory - 1].timestamp;

            const { error: deleteError } = await supabase
                .from(TABLES.USER_INTERACTIONS)
                .delete()
                .eq('userId', userId)
                .lt('timestamp', cutoffTimestamp);

            if (deleteError) {
                throw new Error(`Failed to cleanup old interactions: ${deleteError.message}`);
            }
        } catch (error) {
            console.error('Failed to cleanup old interactions:', error);
        }
    }

    private createEmptyInsights(userId: string): LearningInsights {
        return {
            userId,
            totalInteractions: 0,
            learningConfidence: 0,
            topCategories: [],
            topSources: [],
            emergingTopics: [],
            decliningSources: [],
            recommendedPreferenceUpdates: {},
            lastAnalyzed: new Date(),
        };
    }

    private analyzeItemInteractions(
        interactions: any[],
        _itemType: string,
        itemExtractor: (item: any) => string | undefined
    ): InteractionStats[] {
        const itemStats = new Map<string, {
            total: number;
            positive: number;
            negative: number;
            timestamps: Date[];
        }>();

        for (const interaction of interactions) {
            const item = itemExtractor(interaction);
            if (!item) continue;

            const stats = itemStats.get(item) || {
                total: 0,
                positive: 0,
                negative: 0,
                timestamps: [],
            };

            stats.total++;
            stats.timestamps.push(new Date(interaction.timestamp));

            if (this.config.positiveActions.includes(interaction.action)) {
                stats.positive++;
            } else if (this.config.negativeActions.includes(interaction.action)) {
                stats.negative++;
            }

            itemStats.set(item, stats);
        }

        const results: InteractionStats[] = [];
        for (const [item, stats] of itemStats.entries()) {
            const positiveRatio = stats.total > 0 ? stats.positive / stats.total : 0;
            const lastInteraction = stats.timestamps.reduce((latest, current) =>
                current > latest ? current : latest, new Date(0));

            const midpoint = Math.floor(stats.timestamps.length / 2);
            const recentPositiveRatio = midpoint > 0 ?
                stats.timestamps.slice(0, midpoint).length / midpoint : 0;
            const olderPositiveRatio = midpoint > 0 ?
                stats.timestamps.slice(midpoint).length / (stats.timestamps.length - midpoint) : 0;

            let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
            if (recentPositiveRatio > olderPositiveRatio * 1.2) {
                trend = 'increasing';
            } else if (recentPositiveRatio < olderPositiveRatio * 0.8) {
                trend = 'decreasing';
            }

            results.push({
                item,
                totalInteractions: stats.total,
                positiveInteractions: stats.positive,
                negativeInteractions: stats.negative,
                positiveRatio,
                lastInteraction,
                trend,
            });
        }

        return results.sort((a, b) => {
            const scoreA = a.positiveRatio * Math.log(a.totalInteractions + 1);
            const scoreB = b.positiveRatio * Math.log(b.totalInteractions + 1);
            return scoreB - scoreA;
        });
    }

    private extractEmergingTopics(interactions: any[]): string[] {
        const topicCounts = new Map<string, number>();
        const recentThreshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        for (const interaction of interactions) {
            if (new Date(interaction.timestamp) < recentThreshold) continue;
            if (!this.config.positiveActions.includes(interaction.action)) continue;

            const tags = interaction.articles?.tags || [];
            for (const tag of tags) {
                topicCounts.set(tag, (topicCounts.get(tag) || 0) + 1);
            }
        }

        return Array.from(topicCounts.entries())
            .filter(([, count]) => count >= 2)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([topic]) => topic);
    }

    private identifyDecliningItems(itemStats: InteractionStats[]): string[] {
        return itemStats
            .filter(stat =>
                stat.trend === 'decreasing' &&
                stat.positiveRatio < 0.3 &&
                stat.totalInteractions >= 3
            )
            .slice(0, 5)
            .map(stat => stat.item);
    }

    private calculateLearningConfidence(totalInteractions: number): number {
        if (totalInteractions < this.config.minInteractionsForLearning) {
            return 0;
        }

        const baseConfidence = Math.min(
            Math.log(totalInteractions / this.config.minInteractionsForLearning + 1) / Math.log(10),
            1
        );

        return Math.round(baseConfidence * 100) / 100;
    }

    private async generatePreferenceRecommendations(
        _userId: string,
        _categoryStats: InteractionStats[],
        sourceStats: InteractionStats[],
        emergingTopics: string[]
    ): Promise<Partial<UserPreferences>> {
        const recommendations: Partial<UserPreferences> = {};

        if (emergingTopics.length > 0) {
            recommendations.topics = emergingTopics;
        }

        const preferredSources = sourceStats
            .filter(stat => stat.positiveRatio > 0.6 && stat.totalInteractions >= 3)
            .slice(0, 5)
            .map(stat => stat.item);

        if (preferredSources.length > 0) {
            recommendations.preferredSources = preferredSources;
        }

        const excludedSources = sourceStats
            .filter(stat => stat.positiveRatio < 0.2 && stat.totalInteractions >= 3)
            .slice(0, 3)
            .map(stat => stat.item);

        if (excludedSources.length > 0) {
            recommendations.excludedSources = excludedSources;
        }

        return recommendations;
    }

    private mergeTopics(
        currentTopics: string[],
        emergingTopics: string[],
        confidence: number
    ): string[] {
        const merged = new Set(currentTopics);

        const topicsToAdd = Math.floor(emergingTopics.length * confidence);
        for (let i = 0; i < topicsToAdd && i < emergingTopics.length; i++) {
            merged.add(emergingTopics[i]);
        }

        return Array.from(merged).slice(0, 10);
    }

    private updatePreferredSources(
        currentSources: string[],
        sourceStats: InteractionStats[],
        confidence: number
    ): string[] {
        const preferred = new Set(currentSources);

        const goodSources = sourceStats
            .filter(stat => stat.positiveRatio > 0.7 && stat.totalInteractions >= 3)
            .slice(0, Math.floor(3 * confidence));

        for (const stat of goodSources) {
            preferred.add(stat.item);
        }

        return Array.from(preferred).slice(0, 8);
    }

    private updateExcludedSources(
        currentExcluded: string[],
        decliningSources: string[],
        confidence: number
    ): string[] {
        const excluded = new Set(currentExcluded);

        const sourcesToExclude = Math.floor(decliningSources.length * confidence);
        for (let i = 0; i < sourcesToExclude && i < decliningSources.length; i++) {
            excluded.add(decliningSources[i]);
        }

        return Array.from(excluded).slice(0, 5);
    }
}

export const interactionLearner = new InteractionLearner();