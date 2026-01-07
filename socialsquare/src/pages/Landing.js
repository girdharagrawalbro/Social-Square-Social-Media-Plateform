import React from 'react';
import { Link } from 'react-router-dom';
import Authnav from './components/Authnav';

const Landing = () => {
    return (
        <div className="landing-page">
            <Authnav />
            
            {/* Hero Section */}
            <section className="hero-section">
                <div className="hero-content">
                    <h1 className="pacifico-regular hero-title">Social Square</h1>
                    <p className="hero-subtitle">Connect, Share, and Engage with Your Community</p>
                    <p className="hero-description">
                        Join thousands of users sharing their moments, connecting with friends, 
                        and building meaningful relationships in a safe and vibrant social space.
                    </p>
                    <div className="hero-buttons">
                        <Link to="/signup" className="btn-primary">Get Started</Link>
                        <Link to="/login" className="btn-secondary">Sign In</Link>
                    </div>
                </div>
                <div className="hero-image">
                    <img src="https://i.ibb.co/3zgV9GB/image.png" alt="Social Square Community" />
                </div>
            </section>

            {/* Features Section */}
            <section className="features-section">
                <h2 className="section-title">Why Choose Social Square?</h2>
                <div className="features-grid">
                    <div className="feature-card">
                        <i className="pi pi-users feature-icon"></i>
                        <h3>Connect with Friends</h3>
                        <p>Follow friends, build your network, and stay connected with people who matter.</p>
                    </div>
                    <div className="feature-card">
                        <i className="pi pi-images feature-icon"></i>
                        <h3>Share Your Moments</h3>
                        <p>Post photos, share experiences, and express yourself through captivating content.</p>
                    </div>
                    <div className="feature-card">
                        <i className="pi pi-comments feature-icon"></i>
                        <h3>Real-Time Chat</h3>
                        <p>Instant messaging with your friends. Stay in touch with real-time conversations.</p>
                    </div>
                    <div className="feature-card">
                        <i className="pi pi-bell feature-icon"></i>
                        <h3>Smart Notifications</h3>
                        <p>Never miss important updates with instant notifications for likes, comments, and messages.</p>
                    </div>
                    <div className="feature-card">
                        <i className="pi pi-heart feature-icon"></i>
                        <h3>Engage & Interact</h3>
                        <p>Like, comment, and engage with content from your community.</p>
                    </div>
                    <div className="feature-card">
                        <i className="pi pi-shield feature-icon"></i>
                        <h3>Secure & Private</h3>
                        <p>Your data is protected with enterprise-grade security and encryption.</p>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="cta-section">
                <div className="cta-content">
                    <h2>Ready to Join Our Community?</h2>
                    <p>Create your account now and start connecting with amazing people!</p>
                    <Link to="/signup" className="btn-primary-large">Sign Up Free</Link>
                </div>
            </section>

            {/* Footer */}
            <footer className="landing-footer">
                <div className="footer-content">
                    <div className="footer-brand">
                        <h3 className="pacifico-regular">Social Square</h3>
                        <p>Building connections that matter</p>
                    </div>
                    <div className="footer-links">
                        <div className="footer-column">
                            <h4>Product</h4>
                            <Link to="/login">Features</Link>
                            <Link to="/help">Help Center</Link>
                        </div>
                        <div className="footer-column">
                            <h4>Company</h4>
                            <Link to="/contact">Contact Us</Link>
                            <Link to="/help">Support</Link>
                        </div>
                        <div className="footer-column">
                            <h4>Legal</h4>
                            <a href="#privacy">Privacy Policy</a>
                            <a href="#terms">Terms of Service</a>
                        </div>
                    </div>
                </div>
                <div className="footer-bottom">
                    <p>&copy; 2026 Social Square. All rights reserved.</p>
                </div>
            </footer>
        </div>
    );
};

export default Landing;
