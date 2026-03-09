import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
	Icon,
} from 'n8n-workflow';

export class PdfVectorApi implements ICredentialType {
	name = 'pdfVectorApi';
	displayName = 'PDFVector API';
	documentationUrl = 'https://github.com/phuctm97/pdfvector';
	icon: Icon = 'file:pdfvector.svg';

	properties: INodeProperties[] = [
		{
			displayName: 'Domain',
			name: 'domain',
			type: 'string',
			default: '',
			placeholder: 'https://your-instance.pdfvector.com',
			description: 'The base URL of your PDFVector instance (e.g. https://your-instance.pdfvector.com, your-instance.pdfvector.com). Trailing slashes are removed automatically.',
			required: true,
		},
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '={{"Bearer " + $credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{ (d => d.startsWith("http") ? d : "https://" + d)($credentials.domain.trim().replace(/\\/+$/, "")) }}',
			url: '/api/authenticate/validateCredential',
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
		},
	};
}
