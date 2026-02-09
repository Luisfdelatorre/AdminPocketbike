
import axios from 'axios';

async function testLogin() {
    try {
        console.log('Attempting login...');
        const response = await axios.post('http://localhost:3000/api/auth/login', {
            email: 'admin',
            password: 'Medalla6571*'
        });
        console.log('Login Success:', response.data);
    } catch (error) {
        if (error.response) {
            console.log('Login Failed:', error.response.status, error.response.data);
        } else {
            console.log('Login Error:', error.message);
        }
    }
}

testLogin();
