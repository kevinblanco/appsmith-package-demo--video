export default {
	formData: {
		firstName: '',
		lastName: '',
		email: '',
		password: '',
		confirmPassword: '',
		company: '',
		phone: ''
	},
	
	validationRules: {
		email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
		password: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
		phone: /^[\+]?[1-9][\d]{0,15}$/
	},

	validateEmail(email) {
		if (!email) return { valid: false, error: 'Email is required' };
		if (!this.validationRules.email.test(email)) {
			return { valid: false, error: 'Invalid email format' };
		}
		return { valid: true };
	},

	validatePassword(password) {
		if (!password) return { valid: false, error: 'Password is required' };
		if (password.length < 8) {
			return { valid: false, error: 'Password must be at least 8 characters' };
		}
		if (!this.validationRules.password.test(password)) {
			return { valid: false, error: 'Password must contain uppercase, lowercase, number and special character' };
		}
		return { valid: true };
	},

	validateForm() {
		const errors = {};
		
		if (!this.formData.firstName) errors.firstName = 'First name is required';
		if (!this.formData.lastName) errors.lastName = 'Last name is required';
		
		const emailCheck = this.validateEmail(this.formData.email);
		if (!emailCheck.valid) errors.email = emailCheck.error;
		
		const passwordCheck = this.validatePassword(this.formData.password);
		if (!passwordCheck.valid) errors.password = passwordCheck.error;
		
		if (this.formData.password !== this.formData.confirmPassword) {
			errors.confirmPassword = 'Passwords do not match';
		}
		
		if (this.formData.phone && !this.validationRules.phone.test(this.formData.phone)) {
			errors.phone = 'Invalid phone number format';
		}
		
		return {
			valid: Object.keys(errors).length === 0,
			errors: errors
		};
	},

	async checkEmailExists(email) {
		try {
			// Simulate API call to check if email exists
			const response = await fetch('/api/auth/check-email', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email })
			});
			
			const data = await response.json();
			return { exists: data.exists, available: !data.exists };
		} catch (error) {
			return { exists: false, available: true, error: 'Unable to verify email' };
		}
	},

	updateFormField(field, value) {
		if (this.formData.hasOwnProperty(field)) {
			this.formData[field] = value;
			return { updated: true, field: field, value: value };
		}
		return { updated: false, error: 'Invalid field name' };
	},

	async sendVerificationEmail(email) {
		try {
			const response = await fetch('/api/auth/send-verification', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email })
			});
			
			if (!response.ok) throw new Error('Failed to send verification email');
			
			return { sent: true, message: 'Verification email sent successfully' };
		} catch (error) {
			return { sent: false, error: error.message };
		}
	},

	async registerUser() {
		const validation = this.validateForm();
		if (!validation.valid) {
			await storeValue('signupErrors', validation.errors);
			return { success: false, errors: validation.errors };
		}
		
		// Check if email already exists
		const emailCheck = await this.checkEmailExists(this.formData.email);
		if (emailCheck.exists) {
			return { success: false, error: 'Email already registered' };
		}
		
		try {
			const response = await fetch('/api/auth/register', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					firstName: this.formData.firstName,
					lastName: this.formData.lastName,
					email: this.formData.email,
					password: this.formData.password,
					company: this.formData.company,
					phone: this.formData.phone
				})
			});
			
			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.message || 'Registration failed');
			}
			
			const userData = await response.json();
			
			// Store user data and clear form
			await storeValue('registeredUser', userData);
			await storeValue('signupErrors', {});
			this.clearForm();
			
			// Send verification email
			await this.sendVerificationEmail(this.formData.email);
			
			return { 
				success: true, 
				user: userData,
				message: 'Registration successful! Please check your email for verification.'
			};
			
		} catch (error) {
			await storeValue('signupErrors', { general: error.message });
			return { success: false, error: error.message };
		}
	},

	async verifyEmail(token) {
		try {
			const response = await fetch('/api/auth/verify-email', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ token })
			});
			
			if (!response.ok) throw new Error('Email verification failed');
			
			const result = await response.json();
			await storeValue('emailVerified', true);
			
			return { verified: true, message: 'Email verified successfully!' };
		} catch (error) {
			return { verified: false, error: error.message };
		}
	},

	clearForm() {
		this.formData = {
			firstName: '',
			lastName: '',
			email: '',
			password: '',
			confirmPassword: '',
			company: '',
			phone: ''
		};
		return { cleared: true };
	},

	getPasswordStrength(password) {
		let score = 0;
		let feedback = [];
		
		if (password.length >= 8) score++;
		else feedback.push('At least 8 characters');
		
		if (/[a-z]/.test(password)) score++;
		else feedback.push('Lowercase letter');
		
		if (/[A-Z]/.test(password)) score++;
		else feedback.push('Uppercase letter');
		
		if (/\d/.test(password)) score++;
		else feedback.push('Number');
		
		if (/[@$!%*?&]/.test(password)) score++;
		else feedback.push('Special character');
		
		const strength = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'][score];
		
		return {
			score: score,
			strength: strength,
			feedback: feedback,
			percentage: (score / 5) * 100
		};
	},

	async resendVerification(email) {
		const result = await this.sendVerificationEmail(email);
		if (result.sent) {
			await storeValue('verificationResent', true);
		}
		return result;
	}
}