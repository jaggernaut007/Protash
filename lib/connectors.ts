/**
 * Connector Registry and Sample Data Loaders
 * Provides interface for external data sources (calendar, bank, health, docs)
 */

export interface ConnectorDataSummary {
  type: string;
  summary: string;
  lastUpdated: Date;
  dataPoints: number;
}

/**
 * Calendar Connector - Sample data loader
 */
export const CalendarConnector = {
  type: "calendar",
  name: "Calendar",
  async loadSampleData(): Promise<ConnectorDataSummary> {
    // Mock calendar data
    const events = [
      { date: "2025-12-20", title: "Team Standup", duration: "30m" },
      { date: "2025-12-21", title: "Project Review", duration: "1h" },
      { date: "2025-12-22", title: "One-on-one", duration: "30m" },
    ];

    return {
      type: "calendar",
      summary: `Upcoming events: ${events.map((e) => `${e.title} (${e.duration})`).join(", ")}`,
      lastUpdated: new Date(),
      dataPoints: events.length,
    };
  },
};

/**
 * Bank Connector - Sample data loader
 */
export const BankConnector = {
  type: "bank",
  name: "Bank",
  async loadSampleData(): Promise<ConnectorDataSummary> {
    // Mock bank data
    const transactions = [
      { date: "2025-12-19", description: "Grocery Store", amount: 87.32 },
      { date: "2025-12-18", description: "Gas Station", amount: 45.0 },
      { date: "2025-12-17", description: "Restaurant", amount: 62.50 },
    ];

    const balance = 5234.67;

    return {
      type: "bank",
      summary: `Current balance: $${balance}. Recent spending: ${transactions.map((t) => `$${t.amount}`).join(", ")}`,
      lastUpdated: new Date(),
      dataPoints: transactions.length,
    };
  },
};

/**
 * Wearable Connector - Sample data loader
 */
export const WearableConnector = {
  type: "wearable",
  name: "Wearable",
  async loadSampleData(): Promise<ConnectorDataSummary> {
    // Mock wearable data
    const today = {
      steps: 8234,
      heartRate: 72,
      sleep: 7.5,
      calories: 2100,
    };

    return {
      type: "wearable",
      summary: `Today: ${today.steps} steps, ${today.heartRate} bpm, ${today.sleep}h sleep, ${today.calories} cal`,
      lastUpdated: new Date(),
      dataPoints: 4,
    };
  },
};

/**
 * Docs Connector - Sample data loader
 */
export const DocsConnector = {
  type: "docs",
  name: "Documents",
  async loadSampleData(): Promise<ConnectorDataSummary> {
    // Mock documents
    const docs = [
      { name: "2025 Goals.md", updated: "2025-01-01" },
      { name: "Budget Plan.xlsx", updated: "2025-12-01" },
      { name: "Health Metrics.csv", updated: "2025-12-15" },
    ];

    return {
      type: "docs",
      summary: `Available documents: ${docs.map((d) => d.name).join(", ")}`,
      lastUpdated: new Date(),
      dataPoints: docs.length,
    };
  },
};

/**
 * Connector Registry
 */
export const connectorRegistry = {
  calendar: CalendarConnector,
  bank: BankConnector,
  wearable: WearableConnector,
  docs: DocsConnector,
};

/**
 * Load summaries from enabled connectors
 */
export async function loadConnectorSummaries(
  enabledConnectors: string[]
): Promise<string> {
  const summaries: string[] = [];

  for (const connectorType of enabledConnectors) {
    const connector =
      connectorRegistry[connectorType as keyof typeof connectorRegistry];
    if (connector) {
      try {
        const summary = await connector.loadSampleData();
        summaries.push(`${summary.type}: ${summary.summary}`);
      } catch (error) {
        console.error(`Error loading ${connectorType}:`, error);
      }
    }
  }

  return summaries.join("\n");
}
