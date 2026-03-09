/* eslint-disable n8n-nodes-base/node-filename-against-convention */
import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IDataObject,
	IHttpRequestOptions,
	JsonObject,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeApiError, NodeOperationError } from 'n8n-workflow';

export class PdfVectorV2 implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'PDF Vector V2',
		name: 'pdfVectorV2',
		icon: 'file:pdfvector.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Parse, ask questions, and extract structured data from documents using PDFVector',
		defaults: {
			name: 'PDF Vector V2',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'pdfVectorApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Parse Document',
						value: 'parse',
						description: 'Extract text and page count from a document',
						action: 'Parse a document',
					},
					{
						name: 'Ask Document',
						value: 'ask',
						description: 'Ask a question about a document and get an AI answer',
						action: 'Ask a question about a document',
					},
					{
						name: 'Extract Data',
						value: 'extract',
						description: 'Extract structured data from a document using a JSON Schema',
						action: 'Extract structured data from a document',
					},
				],
				default: 'parse',
			},

			// --- Input Source ---
			{
				displayName: 'Input Source',
				name: 'inputSource',
				type: 'options',
				options: [
					{
						name: 'URL',
						value: 'url',
						description: 'Provide a public URL to the document',
					},
					{
						name: 'Binary Data',
						value: 'binaryData',
						description: 'Use a file from a previous node',
					},
				],
				default: 'url',
			},
			{
				displayName: 'Document URL',
				name: 'url',
				type: 'string',
				default: '',
				required: true,
				placeholder: 'https://example.com/document.pdf',
				description: 'Public URL of the document. Supports Google Docs/Drive, Dropbox, and OneDrive URLs.',
				displayOptions: {
					show: {
						inputSource: ['url'],
					},
				},
			},
			{
				displayName: 'Input Binary Field',
				name: 'binaryPropertyName',
				type: 'string',
				default: 'data',
				required: true,
				description: 'The name of the binary property containing the document file from a previous node',
				displayOptions: {
					show: {
						inputSource: ['binaryData'],
					},
				},
			},

			// --- Ask Operation Fields ---
			{
				displayName: 'Question',
				name: 'question',
				type: 'string',
				default: '',
				required: true,
				placeholder: 'What is the main topic of this document?',
				description: 'The question to ask about the document (minimum 4 characters)',
				displayOptions: {
					show: {
						operation: ['ask'],
					},
				},
			},

			// --- Extract Operation Fields ---
			{
				displayName: 'Prompt',
				name: 'prompt',
				type: 'string',
				typeOptions: { rows: 3 },
				default: '',
				required: true,
				placeholder: 'Extract the invoice number, date, and total amount',
				description: 'Instructions for the AI on what data to extract from the document (minimum 4 characters)',
				displayOptions: {
					show: {
						operation: ['extract'],
					},
				},
			},
			{
				displayName: 'JSON Schema',
				name: 'schema',
				type: 'json',
				default: '{\n  "type": "object",\n  "properties": {\n    "title": { "type": "string" },\n    "date": { "type": "string" },\n    "amount": { "type": "number" }\n  }\n}',
				required: true,
				description: 'JSON Schema describing the structure of the data to extract. Must have a "type" property at the top level.',
				displayOptions: {
					show: {
						operation: ['extract'],
					},
				},
			},

			// --- Document ID (optional, all operations) ---
			{
				displayName: 'Document ID',
				name: 'documentId',
				type: 'string',
				default: '',
				placeholder: 'e.g. doc_abc123',
				description: 'Optional unique ID to track your document. When processing fails, you can upload the document with this ID to our support so we can investigate and improve handling for your file.',
			},

			// --- Model (all operations) ---
			{
				displayName: 'Model',
				name: 'model',
				type: 'options',
				// eslint-disable-next-line n8n-nodes-base/node-param-options-type-unsorted-items
				options: [
					{
						name: 'Auto',
						value: 'auto',
						description: 'Automatically select the best model with intelligent fallback',
					},
					{
						name: 'Nano',
						value: 'nano',
						description: 'Simple documents with plain text. Up to 30 pages, 10MB.',
					},
					{
						name: 'Mini',
						value: 'mini',
						description: 'Documents with tables and structured content. Up to 30 pages, 10MB.',
					},
					{
						name: 'Pro',
						value: 'pro',
						description: 'Documents with tables, handwritten text, figures, math. Up to 30 pages, 40MB.',
					},
					{
						name: 'Max',
						value: 'max',
						description: 'Large documents with full capabilities. Up to 1000 pages, 500MB.',
					},
				],
				default: 'auto',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const credentials = await this.getCredentials('pdfVectorApi');
		const baseUrl = (credentials.domain as string).replace(/\/$/, '');

		for (let i = 0; i < items.length; i++) {
			try {
				const operation = this.getNodeParameter('operation', i) as string;
				const inputSource = this.getNodeParameter('inputSource', i) as string;
				const model = this.getNodeParameter('model', i) as string;

				const body: IDataObject = { model };

				// Handle document input
				if (inputSource === 'url') {
					const url = this.getNodeParameter('url', i) as string;
					body.url = url;
				} else {
					const binaryPropertyName = this.getNodeParameter('binaryPropertyName', i) as string;
					const binaryData = items[i].binary?.[binaryPropertyName];

					if (!binaryData) {
						throw new NodeOperationError(
							this.getNode(),
							`No binary data property "${binaryPropertyName}" exists on item ${i}`,
							{ itemIndex: i },
						);
					}

					const binaryDataBuffer = await this.helpers.getBinaryDataBuffer(i, binaryPropertyName);
					body.base64 = binaryDataBuffer.toString('base64');
				}

				// Add operation-specific fields
				if (operation === 'ask') {
					body.question = this.getNodeParameter('question', i) as string;
				}

				if (operation === 'extract') {
					body.prompt = this.getNodeParameter('prompt', i) as string;
					const schemaString = this.getNodeParameter('schema', i) as string;
					try {
						body.schema = typeof schemaString === 'string' ? JSON.parse(schemaString) : schemaString;
					} catch {
						throw new NodeOperationError(
							this.getNode(),
							'Invalid JSON Schema. Please provide a valid JSON object.',
							{ itemIndex: i },
						);
					}
				}

				const documentId = this.getNodeParameter('documentId', i, '') as string;

				const headers: IDataObject = {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${credentials.apiKey as string}`,
				};

				if (documentId) {
					headers['x-pdfvector-document-id'] = documentId;
				}

				const options: IHttpRequestOptions = {
					method: 'POST',
					url: `${baseUrl}/api/document/${operation}`,
					body,
					headers,
					ignoreHttpStatusErrors: true,
					returnFullResponse: true,
				};

				const response = await this.helpers.httpRequest(options);
				const statusCode = response.statusCode as number;
				const responseBody = response.body as IDataObject;

				if (statusCode >= 400) {
					const errorMessage =
						(responseBody.message as string) ||
						(responseBody.error as string) ||
						`Request failed with status ${statusCode}`;

					if (this.continueOnFail()) {
						const executionData = this.helpers.constructExecutionMetaData(
							this.helpers.returnJsonArray(responseBody),
							{ itemData: { item: i } },
						);
						returnData.push(...executionData);
						continue;
					}

					throw new NodeApiError(this.getNode(), responseBody as JsonObject, {
						itemIndex: i,
						message: (responseBody.code as string) || `Error ${statusCode}`,
						description: errorMessage,
						httpCode: String(statusCode),
					});
				}

				const executionData = this.helpers.constructExecutionMetaData(
					this.helpers.returnJsonArray(responseBody),
					{ itemData: { item: i } },
				);
				returnData.push(...executionData);
			} catch (error) {
				if (error instanceof NodeApiError || error instanceof NodeOperationError) {
					throw error;
				}
				if (this.continueOnFail()) {
					const executionData = this.helpers.constructExecutionMetaData(
						this.helpers.returnJsonArray({ error: (error as Error).message }),
						{ itemData: { item: i } },
					);
					returnData.push(...executionData);
					continue;
				}
				throw new NodeApiError(this.getNode(), error as JsonObject, { itemIndex: i });
			}
		}

		return [returnData];
	}
}
