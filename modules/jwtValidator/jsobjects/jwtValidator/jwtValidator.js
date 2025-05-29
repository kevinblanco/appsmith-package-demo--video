export default {
	currentToken: '',
	refreshToken: '',
	userClaims: {},

	config: {
		audience: 'internal-users',
		expiryBuffer: 5 * 60 * 1000
	},

	decodeToken(token) {
		if (!token) return null;
		try {
			const parts = token.split('.');
			const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
			return payload;
		} catch (error) {
			return null;
		}
	},

	validateToken(token) {
		const decoded = this.decodeToken(token);
		if (!decoded) return { valid: false, reason: 'Invalid token format' };

		const now = Math.floor(Date.now() / 1000);
		if (decoded.exp && decoded.exp < now) {
			return { valid: false, reason: 'Token expired' };
		}

		if (decoded.iss && decoded.iss !== this.config.issuer) {
			return { valid: false, reason: 'Invalid issuer' };
		}

		return { valid: true, claims: decoded };
	},

	async setToken(token, refreshToken = null) {
		const validation = this.validateToken(token);
		if (!validation.valid) {
			await storeValue('authError', validation.reason);
			return { success: false, error: validation.reason };
		}

		this.currentToken = token;
		this.userClaims = validation.claims;
		this.refreshToken = refreshToken || '';

		await storeValue('jwtToken', token);
		await storeValue('userClaims', validation.claims);

		return { success: true, claims: validation.claims };
	},

	needsRefresh() {
		if (!this.userClaims.exp) return true;
		const now = Date.now();
		const expiry = this.userClaims.exp * 1000;
		return (expiry - now) < this.config.expiryBuffer;
	},

	async refreshAuthToken() {
		if (!this.refreshToken) {
			return { success: false, error: 'No refresh token' };
		}

		try {
			// Simulate refresh API call
			const mockNewToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE3MzU2ODk2MDAsInJvbGUiOiJhZG1pbiIsImVtYWlsIjoiam9obi5kb2VAZXhhbXBsZS5jb20ifQ.demo-signature';

			const result = await this.setToken(mockNewToken, this.refreshToken);
			return result.success ? { success: true } : result;
		} catch (error) {
			return { success: false, error: error.message };
		}
	},

	getUserRole() {
		return this.userClaims.role || 'user';
	},

	hasPermission(permission) {
		const permissions = this.userClaims.permissions || [];
		return permissions.includes(permission);
	},

	getAuthHeader() {
		return this.currentToken ? `Bearer ${this.currentToken}` : null;
	},

	async prepareApiCall() {
		if (!this.currentToken) {
			return { ready: false, error: 'Not authenticated' };
		}

		if (this.needsRefresh()) {
			const refreshResult = await this.refreshAuthToken();
			if (!refreshResult.success) {
				return { ready: false, error: refreshResult.error };
			}
		}

		return { ready: true, header: this.getAuthHeader() };
	},

	async logout() {
		this.currentToken = '';
		this.refreshToken = '';
		this.userClaims = {};

		await storeValue('jwtToken', '');
		await storeValue('userClaims', {});

		return { success: true };
	}
}