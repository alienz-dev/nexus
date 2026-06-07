/** Path planner agent — generates learning paths from identified skill gaps. */
import type { SkillGap } from "./gap-detector.js";
import type { AgentResult } from "./types.js";

export interface LearningStep {
  skill: string;
  description: string;
  estimatedHours: number;
  resources: string[];
  priority: number;
}

export interface LearningPath {
  title: string;
  steps: LearningStep[];
  totalHours: number;
  gaps: string[];
}

export class PathPlanner {
  /** Generate a learning path from identified skill gaps. */
  async plan(gaps: SkillGap[]): Promise<{ path: LearningPath; result: AgentResult }> {
    const start = Date.now();

    const steps: LearningStep[] = gaps.map((gap, i) => ({
      skill: gap.skill,
      description: `Improve ${gap.skill} from level ${gap.currentLevel} to ${Math.ceil(gap.demandLevel)}`,
      estimatedHours: Math.ceil(gap.gap * 10), // Rough estimate: 10 hours per gap point
      resources: [],
      priority: i + 1,
    }));

    const path: LearningPath = {
      title: `Learning Path — ${gaps.length} skills to develop`,
      steps,
      totalHours: steps.reduce((sum, s) => sum + s.estimatedHours, 0),
      gaps: gaps.map((g) => g.skill),
    };

    return {
      path,
      result: {
        agentName: "path-planner",
        success: true,
        steps: [],
        output: path,
        durationMs: Date.now() - start,
      },
    };
  }
}
