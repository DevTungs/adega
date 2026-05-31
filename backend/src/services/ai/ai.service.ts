import axios from 'axios';
import { AIResponse } from '../../shared/types';
import { logger } from '../../shared/middlewares/logger';
import { AppError } from '../../shared/errors/app-error';
import { buildAIContext } from './ai.context';
import { parseAIResponse } from './ai.parser';
import { WhatsAppSession } from '../../shared/types';

const AI_API_URL = process.env.AI_API_URL || 'https://api.example.com/v1';
const AI_API_KEY = process.env.AI_API_KEY || '';
const AI_MODEL = process.env.AI_MODEL || 'mimo-v2.5-pro';
const AI_MAX_TOKENS = parseInt(process.env.AI_MAX_TOKENS || '1024');
const AI_TEMPERATURE = parseFloat(process.env.AI_TEMPERATURE || '0.3');

export class AIService {
  async interpretMessage(message: string, session: WhatsAppSession): Promise<AIResponse> {
    let catalog: any[] = [];

    try {
      logger.info({ phone: session.phone, message }, '[AI] Building context...');
      const result = await buildAIContext(session, message);
      catalog = result.catalog;
      const { messages, context } = result;

      logger.info({
        phone: session.phone,
        messageCount: messages.length,
        systemPromptLength: messages[0]?.content?.length,
        url: `${AI_API_URL}/chat/completions`,
        model: AI_MODEL,
      }, '[AI] Sending request to API...');

      const response = await axios.post(
        `${AI_API_URL}/chat/completions`,
        {
          model: AI_MODEL,
          messages,
          max_tokens: AI_MAX_TOKENS,
          temperature: AI_TEMPERATURE,
          response_format: { type: 'json_object' },
        },
        {
          headers: {
            Authorization: `Bearer ${AI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );

      logger.info({
        status: response.status,
        usage: response.data.usage,
        contentLength: response.data.choices?.[0]?.message?.content?.length,
      }, '[AI] API responded');

      let content = response.data.choices?.[0]?.message?.content;
      if (!content) {
        logger.error({ fullResponse: JSON.stringify(response.data) }, '[AI] Empty content in response');
        throw new Error('Empty AI response');
      }

      // Strip markdown code fences if present
      content = content.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();

      logger.info({ content }, '[AI] Parsing JSON...');

      const parsed = parseAIResponse(content);
      if (!parsed) {
        throw new Error('Failed to parse AI response as JSON');
      }
      logger.info({ intent: parsed.intent, confidence: parsed.confidence }, '[AI] Success');

      return this.validateResponse(parsed, catalog);
    } catch (error: any) {
      const apiError = error.response?.data;
      logger.error({
        error: error.message,
        code: error.code,
        status: error.response?.status,
        apiError,
        url: `${AI_API_URL}/chat/completions`,
      }, '[AI] ERROR');
      return this.getFallbackResponse(message);
    }
  }

  private validateResponse(response: AIResponse, catalog: any[]): AIResponse {
    if (!response.products) response.products = [];
    if (!response.message) response.message = 'Desculpa, não entendi. Pode repetir?';
    if (!response.needs_confirmation) response.needs_confirmation = false;
    if (!response.confidence) response.confidence = 0.5;

    // Validate products against catalog
    const allProducts = catalog.flatMap((cat: any) => cat.products);
    response.products = response.products.map((p) => {
      const found = allProducts.find(
        (cp: any) =>
          cp.id === p.product_id ||
          cp.name.toLowerCase() === p.name.toLowerCase()
      );
      if (found) {
        return {
          ...p,
          product_id: found.id,
          price: found.promo_price || found.price,
          valid: true,
        };
      }
      return { ...p, valid: false };
    });

    return response;
  }

  private getFallbackResponse(message: string): AIResponse {
    const normalized = message.toLowerCase().trim();

    if (['cardapio', 'cardápio', 'menu', 'produtos'].includes(normalized)) {
      return {
        intent: 'cardapio',
        products: [],
        needs_confirmation: false,
        confidence: 1,
        message: '',
      };
    }

    if (['promoções', 'promocoes', 'promos', 'ofertas'].includes(normalized)) {
      return {
        intent: 'promocao',
        products: [],
        needs_confirmation: false,
        confidence: 1,
        message: '',
      };
    }

    if (['ajuda', 'help', 'menu'].includes(normalized)) {
      return {
        intent: 'ajuda',
        products: [],
        needs_confirmation: false,
        confidence: 1,
        message: '',
      };
    }

    return {
      intent: 'outro',
      products: [],
      needs_confirmation: false,
      confidence: 0.3,
      message: 'Desculpa, não entendi. Digite *ajuda* para ver as opções.',
    };
  }
}

export const aiService = new AIService();
