export function initializeParticles() {
    const particlesContainer = document.getElementById('particles');
    if (!particlesContainer) return;

    const particleCount = 30;

    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.style.position = 'absolute';
        particle.style.width = Math.random() * 3 + 'px';
        particle.style.height = particle.style.width;
        particle.style.background = 'rgba(99, 102, 241, 0.5)';
        particle.style.borderRadius = '50%';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.top = Math.random() * 100 + '%';
        particle.style.animation = `floatParticle ${Math.random() * 20 + 10}s linear infinite`;
        particle.style.animationDelay = Math.random() * 5 + 's';

        particlesContainer.appendChild(particle);
    }

    // Add CSS animation if not already present
    if (!document.getElementById('particle-animation')) {
        const style = document.createElement('style');
        style.id = 'particle-animation';
        style.textContent = `
      @keyframes floatParticle {
        0% {
          transform: translate(0, 0);
          opacity: 0;
        }
        10% {
          opacity: 1;
        }
        90% {
          opacity: 1;
        }
        100% {
          transform: translate(${Math.random() * 100 - 50}px, -100vh);
          opacity: 0;
        }
      }
    `;
        document.head.appendChild(style);
    }
}
