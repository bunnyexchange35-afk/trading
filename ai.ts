/**
 * AI assistant — PLACEHOLDER integration.
 *
 * Swap `aiReply` / `parseCommand` bodies for a real provider (OpenAI, Anthropic,
 * a self-hosted LLM, …) using config.ai.apiKey / config.ai.apiUrl. Everything
 * else (command logging, confirm-before-execute, action execution) is wired up
 * already, so only these two functions need replacing.
 */

export interface SuggestedAction {
  module: string;
  action: string;
  target?: string;
  params?: Record<string, unknown>;
  description: string;
  confidence: number;
}

export interface ParsedCommand {
  intent: string;
  summary: string;
  actions: SuggestedAction[];
}

export function aiReply(userMessage: string, context?: { userName?: string }): string {
  const name = context?.userName ? ` ${context.userName},` : '';
  const lower = userMessage.toLowerCase();

  if (lower.includes('withdraw')) {
    return `Hi${name} I can help with that. Withdrawals are processed within 24 hours. Could you share the request ID shown in your wallet?`;
  }
  if (lower.includes('login') || lower.includes('password') || lower.includes('2fa')) {
    return `Hi${name} for account security, please use the "Forgot password" flow or check your authenticator app for the 6-digit code. I'm here if you get stuck.`;
  }
  if (lower.includes('deposit')) {
    return `Hi${name} deposits are credited instantly. Use the deposit address in your wallet — confirm the network before sending.`;
  }
  if (lower.includes('leverage') || lower.includes('limit')) {
    return `Hi${name} your current leverage limit is 1:20 for major pairs and 1:5 for altcoins. A support agent can raise a review request for you.`;
  }
  if (lower.includes('down') || lower.includes('error') || lower.includes('bug')) {
    return `Hi${name} all systems are operational on our side. If you're seeing an error, please send a screenshot and the team will investigate.`;
  }
  return `Hi${name} thanks for your message. An agent is reviewing your case and will reply shortly. Is there anything else I can clarify in the meantime?`;
}

/** Extremely simple intent parser for admin commands (placeholder). */
export function parseCommand(command: string): ParsedCommand {
  const c = command.toLowerCase();

  const has = (...words: string[]) => words.some((w) => c.includes(w));

  if (has('lock', 'block', 'ban', 'suspend')) {
    const all = has('all', 'every');
    const countryMatch = command.match(/country\s+([a-z ]+)/i) || command.match(/from\s+([a-z ]+)/i);
    return {
      intent: 'users.restrict',
      summary: all ? 'Restrict all platform users' : `Restrict users${countryMatch ? ` from ${countryMatch[1].trim()}` : ''}`,
      actions: [
        {
          module: 'users',
          action: 'set_status',
          target: countryMatch ? `country:${countryMatch[1].trim()}` : all ? 'all' : 'selection',
          params: { status: c.includes('block') || c.includes('ban') ? 'blocked' : 'locked', reason: 'AI command' },
          description: countryMatch
            ? `Lock all users located in ${countryMatch[1].trim()}`
            : all
              ? 'Lock all users platform-wide'
              : 'Lock the selected users',
          confidence: 0.92,
        },
      ],
    };
  }

  if (has('email', 'mail', 'send')) {
    const warning = has('warning', 'warn', 'negative');
    const audience = has('all', 'everyone') ? 'all' : has('negative', 'balance') ? 'segment:negative_balance' : 'segment';
    return {
      intent: 'email.send',
      summary: warning ? 'Send a warning email' : 'Send an email',
      actions: [
        {
          module: 'emails',
          action: 'send',
          target: audience,
          params: { template: warning ? 'Account warning' : 'Launch promo' },
          description: warning
            ? `Send the "Account warning" template to ${audience === 'all' ? 'all users' : 'users with a negative balance'}`
            : `Compose and send an email to ${audience === 'all' ? 'all users' : 'the selected audience'}`,
          confidence: 0.88,
        },
      ],
    };
  }

  if (has('hero', 'headline', 'homepage', 'text', 'update')) {
    return {
      intent: 'website.edit',
      summary: 'Update the homepage',
      actions: [
        {
          module: 'website',
          action: 'update_section',
          target: 'home/hero',
          params: {},
          description: 'Open the hero section editor for the homepage',
          confidence: 0.9,
        },
      ],
    };
  }

  if (has('popup', 'pop-up', 'announce')) {
    return {
      intent: 'popup.create',
      summary: 'Create a global pop-up',
      actions: [
        {
          module: 'popups',
          action: 'create',
          target: 'all',
          params: { type: 'info' },
          description: 'Create and broadcast a pop-up to all users',
          confidence: 0.86,
        },
      ],
    };
  }

  if (has('campaign', 'launch', 'promo')) {
    return {
      intent: 'campaign.create',
      summary: 'Start a campaign',
      actions: [
        {
          module: 'campaigns',
          action: 'create',
          params: { type: 'promo' },
          description: 'Create a new promo campaign',
          confidence: 0.8,
        },
      ],
    };
  }

  if (has('balance', 'deduct', 'add', 'credit', 'adjust')) {
    return {
      intent: 'balance.adjust',
      summary: 'Adjust a user balance',
      actions: [
        {
          module: 'balances',
          action: 'adjust',
          params: {},
          description: 'Open the balance adjustment dialog for the selected user',
          confidence: 0.82,
        },
      ],
    };
  }

  if (has('agreement', 'contract', 'terms', 'disclaimer')) {
    return {
      intent: 'agreement.generate',
      summary: 'Generate an agreement',
      actions: [
        {
          module: 'agreements',
          action: 'generate',
          params: { type: 'terms' },
          description: 'Generate a new agreement draft with AI',
          confidence: 0.84,
        },
      ],
    };
  }

  return {
    intent: 'unknown',
    summary: 'Could not confidently parse the command',
    actions: [
      {
        module: 'assistant',
        action: 'clarify',
        description: 'Ask the admin to rephrase or choose a module manually',
        confidence: 0.3,
      },
    ],
  };
}

/** Generate a legal-style document (placeholder). */
export function generateAgreementText(type: string, title: string): string {
  const safeTitle = title || 'Hype Coin Control Agreement';
  const sections: Record<string, string> = {
    terms: `1. ACCEPTANCE OF TERMS\nBy accessing or using ${safeTitle}, you agree to be bound by these Terms of Service.\n\n2. ELIGIBILITY\nYou represent that you are of legal age in your jurisdiction and not subject to sanctions.\n\n3. ACCOUNT RESPONSIBILITY\nYou are responsible for safeguarding your credentials and enabling two-factor authentication.\n\n4. PROHIBITED CONDUCT\nMarket manipulation, fraud, and any unlawful activity are strictly prohibited.\n\n5. TERMINATION\nWe may suspend or terminate access for breaches of these Terms.\n\n6. GOVERNING LAW\nThese Terms are governed by the laws of the applicable jurisdiction.`,
    disclaimer: `RISK DISCLOSURE\n\nTrading digital assets involves substantial risk of loss and may not be suitable for all investors.\n\n• Prices are highly volatile.\n• Leverage can amplify both gains and losses.\n• Past performance does not guarantee future results.\n\nYou should never trade with funds you cannot afford to lose. Consult a licensed financial advisor where appropriate.`,
    contract: `PARTNERSHIP AGREEMENT\n\nThis agreement (the "Agreement") is entered between Hype Coin Control ("Company") and the undersigned Partner.\n\n1. SCOPE\nThe Partner agrees to promote the Company's services in accordance with applicable law.\n\n2. COMPENSATION\nThe Partner earns commission per the published schedule.\n\n3. TERM AND TERMINATION\nEither party may terminate with 30 days' written notice.`,
  };
  return sections[type] ?? sections.terms;
}
