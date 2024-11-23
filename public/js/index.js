if (CSS.supports('animation-timeline', 'auto')) {
    document.getElementById('main-image').animate(
        [
            { transform: 'scale(1)', opacity: 1 },
            { transform: 'scale(5)', opacity: 0.8 }
        ],
        {
            duration: 1000,
            fill: 'both',
            timeline: new ScrollTimeline({
                source: document.scrollingElement,
                orientation: 'block',
                scrollOffsets: [CSS.percent(0), CSS.percent(100)]
            })
        }
    );
} else {
    console.log("Scroll Timeline không được hỗ trợ trên trình duyệt này.");
}

const textSpan = document.getElementById('text-span');
const texts = ["Siêu tiết kiệm", "Dịch vụ tận tâm", "Ưu đãi mỗi ngày", "Khuyến mãi hấp dẫn", "Điểm đến của gia đình", "Siêu thị mini - Tiện lợi mỗi ngày"];
let textIndex = 0;
let charIndex = 0;
let deleting = false;
const typingSpeed = 50;
const deletingSpeed = 50;
const pauseTime = 2000;

function type() {
    const currentText = texts[textIndex];
    if (!deleting) {
        textSpan.textContent = currentText.substring(0, charIndex++);
        if (charIndex > currentText.length) {
            deleting = true;
            setTimeout(type, pauseTime);
            return;
        }
    } else {
        textSpan.textContent = currentText.substring(0, charIndex--);
        if (charIndex < 0) {
            deleting = false;
            textIndex = (textIndex + 1) % texts.length;
        }
    }

    setTimeout(type, deleting ? deletingSpeed : typingSpeed);
}

document.addEventListener('DOMContentLoaded', () => {
    type();
});

function changeNavBackground() {
    var nav = document.getElementById("header");
    if (window.scrollY > 30) {
        nav.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
        nav.style.backdropFilter = "blur(10px)";
    } else {
        nav.style.backgroundColor = "transparent";
        nav.style.backdropFilter = "none";
    }
}

window.addEventListener("scroll", changeNavBackground);

var swiper = new Swiper('.swiper-container', {
    loop: true,
    centeredSlides: true,
    slidesPerView: 3,
    spaceBetween: 30,
    autoplay: {
        delay: 2500,
        disableOnInteraction: false,
    },
    breakpoints: {
        320: {
            slidesPerView: 1,
            spaceBetween: 10
        },
        480: {
            slidesPerView: 2,
            spaceBetween: 20
        },
        640: {
            slidesPerView: 3,
            spaceBetween: 30
        }
    },
    on: {
        slideChangeTransitionEnd: function () {
            var slides = document.querySelectorAll('.swiper-slide');
            slides.forEach(function (slide) {
                slide.style.opacity = '0.5';
            });
            document.querySelector('.swiper-slide-active').style.opacity = '1';
        }
    }
});

document.getElementById('play').addEventListener('click', function () {
    window.location.href = '/dashboard';
});

function goToHomepage() {
    window.location.href = '/';
}