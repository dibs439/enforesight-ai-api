import { Request, Response } from 'express';
import OpenAI from 'openai';
import { ClerkAuthRequest } from '../middleware/clerkAuth';
import {
  archiveConversation,
  createConversation,
  getConversation,
  getConversationHistory,
  processAIQuery,
} from '../services/aiChatService';
import { getCustomerConversationsDescending } from '../services/customerConversationService';
import { ApiResponse, ChatMessage, Conversation } from '../types/chat';
import { getConvexClient } from '../utils/convexClient';
import { logger } from '../utils/logger';

const PDFDocument = require('pdfkit');

/** Approximate characters per token for English text (conservative estimate). */
const CHARS_PER_TOKEN = 3;
/** Hard cap on input characters before calling the AI engine. ~4 000 tokens. */
const MAX_QUERY_CHARS = 12_000;
/** Hard cap on the title-generation input fed to OpenAI. ~500 tokens. */
const MAX_TITLE_CHARS = 1_500;

async function generateConversationTitle(
  messages: ChatMessage[]
): Promise<string> {
  try {
    if (!messages || messages.length === 0) return 'Empty Conversation';

    const firstUserMessage = messages.find(m => m.role === 'user');
    if (!firstUserMessage) return 'Conversation';

    const inputContent = firstUserMessage.content.slice(0, MAX_TITLE_CHARS);

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? 'gpt-5.5',
      messages: [
        {
          role: 'system',
          content:
            "Generate a short, concise title (5-10 words) for a conversation based on the user's query. The title should be clear and descriptive. Return only the title text, nothing else.",
        },
        { role: 'user', content: inputContent },
      ],
      max_completion_tokens: 50,
      temperature: 0.5,
    });

    return response.choices[0]?.message?.content?.trim() || 'Conversation';
  } catch (error) {
    logger.error({ err: error }, 'Error generating conversation title');
    return 'Conversation';
  }
}

async function getConversationTitleFromDb(
  conversationId: string
): Promise<string | undefined> {
  try {
    const convexUrl = process.env.CONVEX_URL;
    if (!convexUrl) {
      logger.warn(
        'CONVEX_URL not set, cannot fetch conversation from database'
      );
      return undefined;
    }

    const response = await fetch(`${convexUrl}/api/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: 'customerConversations:getConversation',
        args: { conversationId },
      }),
    });

    if (!response.ok) {
      logger.warn(
        `Failed to fetch conversation from Convex: ${response.statusText}`
      );
      return undefined;
    }

    const conversation = (await response.json()) as any;
    return conversation?.title || undefined;
  } catch (error) {
    logger.warn({ err: error }, 'Error fetching conversation from database');
    return undefined;
  }
}

function renderPdfRecords(doc: any, records: any[]): void {
  records.forEach((record: any, recordIndex: number) => {
    const isLastRecord = recordIndex === records.length - 1;

    if (doc.y > 650 && !isLastRecord) doc.addPage();

    doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#CCCCCC').stroke();
    doc.moveDown(0.5);

    doc
      .fontSize(14)
      .font('Helvetica-Bold')
      .fillColor('#000000')
      .text(record.subjectName || 'Unknown Subject', { align: 'left' });

    const actionType = Array.isArray(record.enforcementActionType)
      ? record.enforcementActionType.join(', ')
      : record.enforcementActionType || 'N/A';
    const regulator = record.regulatorName || 'N/A';
    const actionDate = record.dateOfAction
      ? new Date(record.dateOfAction).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
      : 'N/A';

    doc
      .fontSize(10)
      .font('Helvetica')
      .fillColor('#666666')
      .text(`${actionType} | ${regulator} | ${actionDate}`, { align: 'left' });
    doc.fillColor('#000000');
    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#CCCCCC').stroke();
    doc.moveDown();

    doc.fontSize(11).font('Helvetica-Bold').text('Key Details');
    doc.moveDown(0.3);

    const details: string[] = [];
    if (record.fineAmount) {
      const currency = record.currency || 'USD';
      const formattedAmount = new Intl.NumberFormat('en-US').format(
        record.fineAmount
      );
      details.push(`Fine Amount: ${currency} ${formattedAmount}`);
    }
    if (record.sector) details.push(`Sector: ${record.sector}`);
    if (record.jurisdiction)
      details.push(`Jurisdiction: ${record.jurisdiction}`);
    if (record.field) details.push(`Field: ${record.field}`);

    details.forEach(detail =>
      doc.fontSize(10).font('Helvetica').text(`• ${detail}`, { indent: 10 })
    );

    if (
      record.violationTypes &&
      Array.isArray(record.violationTypes) &&
      record.violationTypes.length > 0
    ) {
      doc
        .fontSize(10)
        .font('Helvetica')
        .text('• Violation Types:', { indent: 10 });
      record.violationTypes.forEach((vType: string) => {
        doc.fontSize(10).font('Helvetica').text(`  - ${vType}`, { indent: 20 });
      });
    }

    doc.moveDown();

    if (record.enforcementNoticeSummary) {
      if (doc.y > 650 && !isLastRecord) doc.addPage();
      doc.fontSize(11).font('Helvetica-Bold').text('Action Summary');
      doc.moveDown(0.3);
      doc
        .fontSize(10)
        .font('Helvetica')
        .text(record.enforcementNoticeSummary, {
          align: 'justify',
          lineGap: 3,
        });
      doc.moveDown();
    }

    doc.fontSize(11).font('Helvetica-Bold').text('Reference');
    doc.moveDown(0.3);

    if (record.documentId) {
      doc
        .fontSize(9)
        .font('Helvetica')
        .text(`Document ID: ${record.documentId}`);
    }
    if (record.enforcementNoticeUrl) {
      doc
        .fontSize(9)
        .font('Helvetica')
        .fillColor('#0066CC')
        .text(`Notice URL: ${record.enforcementNoticeUrl}`, {
          link: record.enforcementNoticeUrl,
          underline: true,
        });
      doc.fillColor('#000000');
    }

    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#CCCCCC').stroke();
    doc.moveDown();
  });
}

function renderPdfContent(doc: any, content: any): void {
  let isStructuredResponse = false;
  let parsedContent = content;

  if (typeof content === 'string') {
    try {
      const parsed = JSON.parse(content);
      if (
        parsed.summary &&
        parsed.count !== undefined &&
        Array.isArray(parsed.records)
      ) {
        parsedContent = parsed;
        isStructuredResponse = true;
      }
    } catch (_e) {
      // not JSON
    }
  } else if (
    content &&
    typeof content === 'object' &&
    content.summary &&
    content.count !== undefined &&
    Array.isArray(content.records)
  ) {
    isStructuredResponse = true;
  }

  if (isStructuredResponse && parsedContent.records) {
    doc
      .fontSize(12)
      .font('Helvetica-Bold')
      .text(parsedContent.summary || 'Search Results', { align: 'left' });
    doc.moveDown(0.5);
    renderPdfRecords(doc, parsedContent.records);
  } else {
    const textContent =
      typeof parsedContent === 'string'
        ? parsedContent
        : JSON.stringify(parsedContent);
    doc
      .fontSize(11)
      .font('Helvetica')
      .text(textContent, { align: 'left', lineGap: 2 });
  }
}

export class AiChatController {
  async chat(req: Request, res: Response): Promise<Response | void> {
    try {
      const { query } = req.body;
      const user = (req as any).user;
      const userId = user?.userId;

      if (!userId) {
        return res
          .status(401)
          .json({
            success: false,
            error: 'User ID not found in token',
          } as ApiResponse<null>);
      }

      const conversationIdFromHeader = req.headers['x-conversation-id'] as
        | string
        | undefined;

      if (query.length > MAX_QUERY_CHARS) {
        const estimatedTokens = Math.ceil(query.length / CHARS_PER_TOKEN);
        logger.warn(
          { userId, queryLength: query.length, estimatedTokens },
          'Query exceeds input budget'
        );
        return res.status(400).json({
          success: false,
          error: `Query is too long. Maximum allowed length is ${MAX_QUERY_CHARS} characters (≈${Math.ceil(MAX_QUERY_CHARS / CHARS_PER_TOKEN)} tokens).`,
        } as ApiResponse<null>);
      }

      let conversationId = conversationIdFromHeader;
      let isNewConversation = false;

      if (!conversationId) {
        logger.info(
          { userId },
          'No conversation_id provided, creating new conversation'
        );
        try {
          conversationId = await createConversation(userId);
          isNewConversation = true;
          logger.info({ conversationId }, 'Created new conversation');
        } catch (error) {
          logger.error({ err: error }, 'Failed to create conversation');
          return res
            .status(500)
            .json({
              success: false,
              error: 'Failed to create conversation',
            } as ApiResponse<null>);
        }
      }

      const chatQuery: any = {
        user_id: userId,
        conversation_id: conversationId!,
        query,
        is_new_conversation: isNewConversation,
      };

      if (isNewConversation) chatQuery.conversation_title = query;

      const result = await processAIQuery(chatQuery);

      return res.json({
        success: true,
        data: {
          ...result,
          conversation_id: conversationId,
          is_new_conversation: isNewConversation,
        },
      } as ApiResponse<any>);
    } catch (error) {
      logger.error({ err: error }, 'Chat error');
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      } as ApiResponse<null>);
    }
  }

  async getAllConversations(req: Request, res: Response): Promise<Response> {
    try {
      const customerId = (req.user as any)?.userId;
      if (!customerId) {
        return res
          .status(401)
          .json({
            success: false,
            error: 'User not authenticated',
          } as ApiResponse<null>);
      }

      const conversations =
        await getCustomerConversationsDescending(customerId);

      return res.json({
        success: true,
        data: conversations,
        count: conversations.length,
      } as ApiResponse<any[]>);
    } catch (error: any) {
      logger.error({ err: error }, 'Get all conversations error');
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to get conversations',
      } as ApiResponse<null>);
    }
  }

  async getConversation(
    req: ClerkAuthRequest,
    res: Response
  ): Promise<Response> {
    try {
      const conversationId = req.params.id as string;
      const result = await getConversation(conversationId);

      if (!result) {
        return res
          .status(404)
          .json({
            success: false,
            error: 'Conversation not found',
          } as ApiResponse<null>);
      }

      return res.json({
        success: true,
        data: result,
      } as ApiResponse<Conversation>);
    } catch (error) {
      logger.error({ err: error }, 'Get conversation error');
      return res.status(500).json({
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to get conversation',
      } as ApiResponse<null>);
    }
  }

  async getHistory(req: Request, res: Response): Promise<Response> {
    try {
      const conversationId = req.params.conversationId as string;
      const limit = parseInt(req.query.limit as string) || 50;

      if (!conversationId) {
        return res.status(400).json({
          success: false,
          error: 'Conversation ID is required',
        } as ApiResponse<null>);
      }

      const historyData = await getConversationHistory(conversationId, limit);
      const messages = historyData.messages;

      if (messages.length === 0) {
        try {
          const convResult = await getConversation(conversationId);
          if (!convResult) {
            return res.status(404).json({
              success: false,
              error: 'Conversation not found',
              message: `No conversation found with ID: ${conversationId}. Please create a conversation by sending a message first.`,
            } as ApiResponse<null>);
          }
        } catch (err) {
          logger.warn({ err }, 'Could not verify conversation existence');
        }
      }

      let title = await getConversationTitleFromDb(conversationId);
      if (!title && messages.length > 0)
        title = await generateConversationTitle(messages);
      title = title || 'Conversation';

      return res.json({
        success: true,
        data: {
          title,
          conversationId,
          messageCount: messages.length,
          messages,
        },
      } as ApiResponse<{
        title: string;
        conversationId: string;
        messageCount: number;
        messages: ChatMessage[];
      }>);
    } catch (error) {
      logger.error({ err: error }, 'Get conversation history error');
      return res.status(500).json({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to get conversation history',
      } as ApiResponse<null>);
    }
  }

  async archiveConversation(
    req: ClerkAuthRequest,
    res: Response
  ): Promise<Response> {
    try {
      const conversationId = req.params.id as string;
      const result = await archiveConversation(
        conversationId,
        req.clerkUser?.id ?? 'system'
      );

      return res.json({ success: true, data: result } as ApiResponse<{
        archived: boolean;
      }>);
    } catch (error) {
      logger.error({ err: error }, 'Archive conversation error');
      return res.status(500).json({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to archive conversation',
      } as ApiResponse<null>);
    }
  }

  async updatePinned(req: Request, res: Response): Promise<Response> {
    try {
      const conversationId = req.params.conversationId as string;
      const { isPinned } = req.body;

      const convexClient = getConvexClient();
      const result = await convexClient.mutation(
        'customerConversations:updateConversationPinned' as any,
        { conversationId, isPinned }
      );

      if (!result) {
        return res
          .status(404)
          .json({
            success: false,
            error: 'Conversation not found',
          } as ApiResponse<null>);
      }

      return res.json({
        success: true,
        data: {
          conversationId,
          isPinned,
          message: `Conversation ${isPinned === 1 ? 'pinned' : 'unpinned'} successfully`,
        },
      } as ApiResponse<{
        conversationId: string;
        isPinned: number;
        message: string;
      }>);
    } catch (error: any) {
      logger.error({ err: error }, 'Error updating conversation pinned status');
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to update conversation',
      } as ApiResponse<null>);
    }
  }

  async getMessages(req: ClerkAuthRequest, res: Response): Promise<Response> {
    try {
      const conversationId = req.params.conversationId as string;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;

      logger.debug({ conversationId, limit }, 'Fetching conversation history');

      const convexClient = getConvexClient();
      const messages = await convexClient.query(
        'conversationMessages:getMessages' as any,
        { conversationId }
      );

      const limitedMessages =
        limit && messages.length > limit ? messages.slice(-limit) : messages;

      const formattedMessages = limitedMessages.map((message: any) => {
        if (message.role === 'assistant' && message.content) {
          try {
            const parsed = JSON.parse(message.content);
            if (
              parsed.summary !== undefined &&
              parsed.count !== undefined &&
              parsed.records !== undefined
            ) {
              return { ...message, content: parsed };
            }
          } catch (_e) {
            // not JSON
          }
        }
        return message;
      });

      logger.debug(
        { messageCount: formattedMessages.length },
        'Retrieved messages'
      );
      return res.json({
        success: true,
        data: {
          conversationId,
          messageCount: formattedMessages.length,
          messages: formattedMessages,
          retrievedAt: new Date().toISOString(),
        },
      } as ApiResponse<any>);
    } catch (error) {
      logger.error({ err: error }, 'Get conversation history error');
      return res.status(500).json({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to get conversation history',
      } as ApiResponse<null>);
    }
  }

  async exportConversation(
    req: ClerkAuthRequest,
    res: Response
  ): Promise<void> {
    try {
      const conversationId = req.params.conversationId as string;
      logger.info({ conversationId }, 'Exporting conversation to PDF');

      const convexClient = getConvexClient();
      const messages = await convexClient.query(
        'conversationMessages:getMessages' as any,
        { conversationId }
      );

      if (!messages || messages.length === 0) {
        res
          .status(404)
          .json({
            success: false,
            error: 'No messages found for this conversation',
          } as ApiResponse<null>);
        return;
      }

      const doc = new PDFDocument({ margin: 50 });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="conversation-${conversationId}.pdf"`
      );
      doc.pipe(res);

      doc
        .fontSize(20)
        .text('Enforesight - Conversation History', { align: 'center' });
      doc.moveDown();
      doc
        .fontSize(10)
        .text(`Conversation ID: ${conversationId}`, { align: 'left' });
      doc.text(`Exported: ${new Date().toLocaleString()}`, { align: 'left' });
      doc.moveDown();
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown();

      messages.forEach((message: any, index: number) => {
        const role = message.role === 'user' ? 'User' : 'Assistant';
        const timestamp = new Date(message.timestamp).toLocaleString();

        doc
          .fontSize(12)
          .font('Helvetica-Bold')
          .text(`${role}`, { continued: true });
        doc
          .fontSize(9)
          .font('Helvetica')
          .fillColor('#666666')
          .text(` - ${timestamp}`, { align: 'left' });
        doc.fillColor('#000000');
        doc.moveDown(0.5);

        renderPdfContent(doc, message.content);

        doc.moveDown();
        if (index < messages.length - 1) {
          doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
          doc.moveDown();
          if (doc.y > 700) doc.addPage();
        }
      });

      doc
        .fontSize(8)
        .fillColor('#999999')
        .text(
          `Generated by Enforesight AI Engine | ${messages.length} messages`,
          50,
          doc.page.height - 50,
          { align: 'center' }
        );

      doc.end();
      logger.info({ conversationId }, 'PDF stream initiated for conversation');
    } catch (error) {
      logger.error({ err: error }, 'Export conversation to PDF error');
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error:
            error instanceof Error
              ? error.message
              : 'Failed to export conversation',
        } as ApiResponse<null>);
      }
    }
  }

  async exportMessage(req: Request, res: Response): Promise<void> {
    try {
      const { messageId } = req.params;
      const userId = (req as any).user?.userId;

      logger.info({ messageId, userId }, 'Exporting message to PDF');

      if (!userId) {
        res
          .status(401)
          .json({
            success: false,
            error: 'User not authenticated',
          } as ApiResponse<null>);
        return;
      }

      const convexClient = getConvexClient();
      const message = await convexClient.query(
        'conversationMessages:getMessage' as any,
        { messageId }
      );

      if (!message) {
        res
          .status(404)
          .json({
            success: false,
            error: 'Message not found',
          } as ApiResponse<null>);
        return;
      }

      const conversation = await convexClient.query(
        'customerConversations:getConversation' as any,
        { conversationId: message.conversationId }
      );

      if (!conversation) {
        res
          .status(404)
          .json({
            success: false,
            error: 'Associated conversation not found',
          } as ApiResponse<null>);
        return;
      }

      if (conversation.customerId !== userId) {
        logger.warn(
          { userId, ownerId: conversation.customerId },
          'Unauthorized access attempt: user tried to access message from another user'
        );
        res
          .status(403)
          .json({
            success: false,
            error: 'Unauthorized to access this message',
          } as ApiResponse<null>);
        return;
      }

      const doc = new PDFDocument({ margin: 50 });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="message-${messageId}.pdf"`
      );
      doc.pipe(res);

      doc
        .fontSize(20)
        .text('Enforesight - Message Export', { align: 'center' });
      doc.moveDown();
      doc.fontSize(10).text(`Message ID: ${messageId}`, { align: 'left' });
      doc.text(`Exported: ${new Date().toLocaleString()}`, { align: 'left' });
      doc.moveDown();
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown();

      const role = message.role === 'user' ? 'User' : 'Assistant';
      const timestamp = new Date(message.timestamp).toLocaleString();

      doc.fontSize(14).font('Helvetica-Bold').text(role, { continued: true });
      doc
        .fontSize(11)
        .font('Helvetica')
        .fillColor('#666666')
        .text(` - ${timestamp}`, { align: 'left' });
      doc.fillColor('#000000');
      doc.moveDown();
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown();

      renderPdfContent(doc, message.content);

      doc
        .fontSize(8)
        .fillColor('#999999')
        .text(`Generated by Enforesight AI Engine`, 50, doc.page.height - 50, {
          align: 'center',
        });

      doc.end();
      logger.info({ messageId }, 'PDF stream initiated for message');
    } catch (error) {
      logger.error({ err: error }, 'Export message to PDF error');
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error:
            error instanceof Error ? error.message : 'Failed to export message',
        } as ApiResponse<null>);
      }
    }
  }
}

export const aiChatController = new AiChatController();
