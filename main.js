/**
 * e-Tester: 자연상수 e 관련 확률 실험 애플리케이션
 * 작성일: 2025.05.10
 *
 * 이 프로그램은 완전순열(derangement) 확률 실험을 시각화합니다.
 * n개의 동전을 무작위로 섞었을 때 모든 동전이 원래 위치에 없을 확률이 1/e(≈0.367879)에 수렴함을 보여줍니다.
 */

// 전역 상태 관리 객체
const ExperimentState = {
  totalTrials: 0,
  successCount: 0,
  intervalId: null,
  isRunning: false,
  chart: null,
  distributionChart: null,
  experimentResults: [],
  streakData: {
    currentSuccessStreak: 0,
    currentFailStreak: 0,
    maxSuccessStreak: 0,
    maxFailStreak: 0,
  },
  coinPositionStats: {},
  MAX_DATA_POINTS: 200,
  // 실험 설정
  settings: {
    speed: 150,
    maxCoins: 100,
  },
  // 수학 상수
  constants: {
    e: Math.E.toFixed(6),
    oneOverE: (1 / Math.E).toFixed(6),
  },
};

// 유틸리티 함수들
const Utils = {
  /**
   * 배열을 무작위로 섞는 함수 (Fisher-Yates 알고리즘)
   * @param {Array} array - 섞을 배열
   * @returns {Array} - 섞인 배열
   */
  shuffle(array) {
    const newArray = [...array]; // 원본 배열을 변경하지 않기 위해 복사
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  },

  /**
   * 숫자를 지정된 소수점 자리수로 포맷팅
   * @param {number} num - 포맷팅할 숫자
   * @param {number} digits - 소수점 자리수 (기본값: 4)
   * @returns {string} - 포맷팅된 숫자 문자열
   */
  formatNumber(num, digits = 4) {
    return num.toFixed(digits);
  },

  /**
   * 요소의 클래스를 토글하면서 애니메이션 효과 적용
   * @param {HTMLElement} element - 대상 요소
   * @param {string} className - 토글할 클래스 이름
   * @param {boolean} force - 강제 적용 여부 (선택 사항)
   */
  toggleClassWithAnimation(element, className, force) {
    if (element) {
      // 애니메이션 효과를 위해 요소를 리플로우
      element.classList.remove("animated");
      void element.offsetWidth; // 리플로우 트리거
      element.classList.add("animated");
      element.classList.toggle(className, force);
    }
  },

  /**
   * 토스트 메시지 표시
   * @param {string} message - 표시할 메시지
   * @param {string} type - 메시지 유형 (성공, 오류 등)
   */
  showToast(message, type = "info") {
    const toast = document.getElementById("toast-message");
    const toastContent = toast.querySelector(".toast-content");
    const toastIcon = toast.querySelector(".toast-icon i");

    // 메시지 유형에 따른 아이콘 설정
    let iconClass = "fa-info-circle";
    if (type === "success") iconClass = "fa-check-circle";
    else if (type === "error") iconClass = "fa-exclamation-circle";
    else if (type === "warning") iconClass = "fa-exclamation-triangle";

    // 아이콘 및 내용 설정
    toastIcon.className = `fas ${iconClass}`;
    toastContent.textContent = message;

    // 토스트 표시 및 타이머 설정
    toast.classList.add("show", type);

    // 기존 타이머 제거
    if (toast.timeoutId) clearTimeout(toast.timeoutId);

    // 새 타이머 설정
    toast.timeoutId = setTimeout(() => {
      toast.classList.remove("show", type);
    }, 3000);
  },
};

// 차트 관리자
const ChartManager = {
  /**
   * 메인 실험 결과 차트 초기화
   */
  initializeMainChart() {
    const canvasElement = document.getElementById("chart");
    // canvas 요소가 존재하고, 해당 탭이 활성화 상태일 때만 초기화
    if (!canvasElement || canvasElement.offsetParent === null) { // offsetParent === null 이면 숨겨진 상태
      // console.log("메인 차트 canvas가 숨겨져 있어 초기화하지 않습니다.");
      return;
    }
    if (ExperimentState.chart) {
      ExperimentState.chart.destroy();
    }
    const ctx = canvasElement.getContext("2d");
    ExperimentState.chart = new Chart(ctx, {
      type: "line",
      data: {
        labels: [],
        datasets: [
          {
            label: "누적 성공률",
            data: [],
            borderColor: getComputedStyle(document.documentElement)
              .getPropertyValue("--chart-line")
              .trim(),
            backgroundColor: "rgba(33, 150, 243, 0.1)",
            borderWidth: 2,
            tension: 0.4,
            pointRadius: (ctx) => (ctx.dataIndex % 10 === 0 ? 3 : 0),
            pointHoverRadius: 5,
          },
          {
            label: "y = 1/e ≈ " + ExperimentState.constants.oneOverE,
            data: [],
            borderColor: getComputedStyle(document.documentElement)
              .getPropertyValue("--chart-reference")
              .trim(),
            borderDash: [5, 5],
            borderWidth: 2,
            pointRadius: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "top",
            labels: { font: { size: 12, weight: "bold" }, boxWidth: 15, usePointStyle: true },
          },
          tooltip: {
            backgroundColor: "rgba(0, 0, 0, 0.8)",
            titleFont: { size: 14 }, bodyFont: { size: 13 }, padding: 10,
            callbacks: {
              label: function (context) {
                const value = context.raw;
                const theoreticalValue = ExperimentState.constants.oneOverE;
                const diff = Math.abs(value - theoreticalValue).toFixed(6);
                if (context.datasetIndex === 0) {
                  return [`성공률: ${value}`, `이론값과의 차이: ${diff}`];
                } else {
                  return `이론값 (1/e): ${theoreticalValue}`;
                }
              },
            },
          },
        },
        scales: {
          y: { min: 0, max: 1, ticks: { stepSize: 0.1, font: { size: 11 } }, grid: { color: "rgba(0, 0, 0, 0.1)" }, title: { display: true, text: "성공률", font: { size: 12, weight: "bold" } } },
          x: { grid: { color: "rgba(0, 0, 0, 0.1)" }, ticks: { font: { size: 11 }, maxTicksLimit: 10 }, title: { display: true, text: "실험 횟수", font: { size: 12, weight: "bold" } } },
        },
        animation: { duration: 500, easing: "easeOutQuad" },
      },
    });
    // console.log("메인 차트 초기화 완료");
  },

  /**
   * 분포 차트 초기화
   */
  initializeDistributionChart() {
    const canvasElement = document.getElementById("distribution-chart");
    if (!canvasElement || canvasElement.offsetParent === null) {
      // console.log("분포 차트 canvas가 숨겨져 있어 초기화하지 않습니다.");
      return;
    }
    if (ExperimentState.distributionChart) {
      ExperimentState.distributionChart.destroy();
    }
    const ctx = canvasElement.getContext("2d");
    ExperimentState.distributionChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: [],
        datasets: [
          {
            label: "동전별 제자리 위치 확률",
            data: [],
            backgroundColor: "rgba(255, 99, 132, 0.7)",
            borderColor: "rgb(255, 99, 132)",
            borderWidth: 1,
            borderRadius: 3,
            barPercentage: 0.8,
            categoryPercentage: 0.8
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            padding: 8,
            callbacks: {
              label: function (context) {
                const value = context.raw;
                return `확률: ${(value * 100).toFixed(2)}%`;
              },
            },
          },
        },
        scales: {
          y: { 
            beginAtZero: true, 
            max: 1, 
            title: { display: true, text: "제자리에 있을 확률", font: { size: 11, weight: "bold" } },
            ticks: { font: { size: 10 }, padding: 5 },
            grid: { display: true, color: 'rgba(0, 0, 0, 0.05)' } 
          },
          x: { 
            title: { display: true, text: "동전 번호", font: { size: 11, weight: "bold" } },
            ticks: { font: { size: 10 }, padding: 5 },
            grid: { display: false }
          },
        },
        layout: {
          padding: {
            left: 0,
            right: 10,
            top: 5,
            bottom: 0
          }
        }
      },
    });
    // console.log("분포 차트 초기화 완료");
  },

  /**
   * 메인 차트 데이터 업데이트
   * @param {number} decimal - 현재 성공률
   * @param {boolean} updateChart - 차트 업데이트 여부
   */
  updateMainChart(decimal, updateChart = true) {
    const chart = ExperimentState.chart;
    if (!chart) return;
  
    const MAX = ExperimentState.MAX_DATA_POINTS;
    if (chart.data.labels.length >= MAX) {
      chart.data.labels.shift();
      // datasets[1]도 함께 shift 해야 함
      chart.data.datasets[0].data.shift();
      if (chart.data.datasets[1]) { // 이론값 데이터셋이 존재하면
        chart.data.datasets[1].data.shift();
      }
    }
  
    chart.data.labels.push(ExperimentState.totalTrials);
    chart.data.datasets[0].data.push(parseFloat(decimal));
    if (chart.data.datasets[1]) { // 이론값 데이터셋이 존재하면
      chart.data.datasets[1].data.push(parseFloat(ExperimentState.constants.oneOverE));
    }
  
    if (updateChart) chart.update("none");
  },

  /**
   * 분포 차트 업데이트
   */
  updateDistributionChart() {
    const chart = ExperimentState.distributionChart;
    if (!chart) return; // 차트가 없으면 업데이트 시도 안함

    const stats = ExperimentState.coinPositionStats;
    const kInput = document.getElementById("k");
    if (!kInput) return;
    const k = parseInt(kInput.value);

    chart.data.labels = []; // 이전 데이터 완전히 초기화
    chart.data.datasets[0].data = []; // 이전 데이터 완전히 초기화

    for (let i = 1; i <= k; i++) {
      chart.data.labels.push(i.toString());
      const inPlaceCount = stats[i] || 0;
      const probability = ExperimentState.totalTrials > 0 ? inPlaceCount / ExperimentState.totalTrials : 0;
      chart.data.datasets[0].data.push(probability);
    }
    chart.update();
  },

  /**
   * 모든 차트 업데이트
   */
  updateAllCharts() {
    if (ExperimentState.totalTrials > 0 && ExperimentState.successCount >= 0) {
        ChartManager.updateMainChart(
            Utils.formatNumber(ExperimentState.successCount / ExperimentState.totalTrials)
        );
    } else {
        // 실험 횟수가 0일 때 차트 초기 상태 또는 빈 상태로 업데이트
        ChartManager.updateMainChart("0.0000");
    }
    ChartManager.updateDistributionChart();
  },
};

// UI 관리자
const UIManager = {
  /**
   * 모든 UI 요소 초기화
   */
  initialize() {
    this.initializeTabSystem();
    this.initializeThemeToggle();
    this.initializeModalSystem();
    this.initializeInputControls();
    this.initializeToastControls();
    this.updateStatistics();
    
    // 초기에 활성화된 탭에 대한 차트 초기화 시도
    const activeTabId = document.querySelector(".tab-btn.active")?.getAttribute("data-tab");
    if (activeTabId === "experiment") {
        ChartManager.initializeMainChart();
    } else if (activeTabId === "statistics") {
        ChartManager.initializeDistributionChart();
    }
  },

  /**
   * 탭 시스템 초기화
   */
  initializeTabSystem() {
    const tabButtons = document.querySelectorAll(".tab-btn");
    const tabContents = document.querySelectorAll(".tab-content");

    tabButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const tabId = button.getAttribute("data-tab");

        tabButtons.forEach((btn) => btn.classList.remove("active"));
        button.classList.add("active");

        tabContents.forEach((content) => {
          const isActive = content.id === tabId;
          content.classList.toggle("active", isActive);
          content.style.display = isActive ? "block" : "none";

          // 탭이 활성화될 때 해당 탭의 차트 초기화 (아직 안 됐으면)
          if (isActive) {
            if (tabId === "experiment" && !ExperimentState.chart) {
              ChartManager.initializeMainChart();
            } else if (tabId === "statistics" && !ExperimentState.distributionChart) {
              ChartManager.initializeDistributionChart();
            }
          }
        });
      });
    });

    // 페이지 로드 시 초기 활성 탭 설정 (이미 active 클래스가 HTML에 있다면 이 부분은 중복될 수 있으나, 안전장치로 둠)
    let initiallyActiveTabFound = false;
    tabContents.forEach((content) => {
      if (content.classList.contains("active")) {
        content.style.display = "block";
        initiallyActiveTabFound = true;
      } else {
        content.style.display = "none";
      }
    });
    // 만약 HTML에 active 클래스가 없다면 첫 번째 탭을 강제로 활성화 (선택적)
    if (!initiallyActiveTabFound && tabButtons.length > 0 && tabContents.length > 0) {
        tabButtons[0].classList.add("active");
        tabContents[0].classList.add("active");
        tabContents[0].style.display = "block";
        // 이 경우 첫 번째 탭의 차트 초기화도 고려해야 함
        const firstTabId = tabButtons[0].getAttribute("data-tab");
        if (firstTabId === "experiment" && !ExperimentState.chart) {
            ChartManager.initializeMainChart();
        } else if (firstTabId === "statistics" && !ExperimentState.distributionChart) {
            ChartManager.initializeDistributionChart();
        }
    }
  },

  /**
   * 테마 토글 초기화
   */
  initializeThemeToggle() {
    const themeSwitch = document.getElementById("theme-switch");

    // 저장된 테마 적용
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
      themeSwitch.checked = true;
    }

    // 테마 변경 이벤트 리스너
    themeSwitch.addEventListener("change", () => {
      if (themeSwitch.checked) {
        document.documentElement.setAttribute("data-theme", "dark");
        localStorage.setItem("theme", "dark");
      } else {
        document.documentElement.removeAttribute("data-theme");
        localStorage.setItem("theme", "light");
      }

      // 차트 색상 업데이트 (테마 변경 시 색상 적용)
      setTimeout(() => {
        if (ExperimentState.chart) {
          ExperimentState.chart.data.datasets[0].borderColor = getComputedStyle(
            document.documentElement
          )
            .getPropertyValue("--chart-line")
            .trim();
          ExperimentState.chart.data.datasets[1].borderColor = getComputedStyle(
            document.documentElement
          )
            .getPropertyValue("--chart-reference")
            .trim();
          ExperimentState.chart.update();
        }
      }, 300);
    });
  },

  /**
   * 모달 시스템 초기화
   */
  initializeModalSystem() {
    const modal = document.getElementById("help-modal");
    const btn = document.getElementById("help-btn");
    const span = document.querySelector(".close-modal");

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      modal.style.display = "block";
      setTimeout(() => modal.classList.add("show"), 10);
    });

    span.addEventListener("click", () => {
      modal.classList.remove("show");
      setTimeout(() => (modal.style.display = "none"), 300);
    });

    window.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.classList.remove("show");
        setTimeout(() => (modal.style.display = "none"), 300);
      }
    });
  },

  /**
   * 입력 컨트롤 초기화
   */
  initializeInputControls() {
    const decreaseBtn = document.querySelector(".decrease-btn");
    const increaseBtn = document.querySelector(".increase-btn");
    const kInput = document.getElementById("k");

    if (decreaseBtn && kInput) {
        decreaseBtn.addEventListener("click", () => {
            const currentValue = parseInt(kInput.value);
            if (currentValue > 1) kInput.value = currentValue - 1;
        });
    }
    if (increaseBtn && kInput) {
        increaseBtn.addEventListener("click", () => {
            const currentValue = parseInt(kInput.value);
            if (currentValue < ExperimentState.settings.maxCoins) kInput.value = currentValue + 1;
        });
    }

    const speedSlider = document.getElementById("speed-slider");
    const speedValue = document.getElementById("speed-value");
    if (speedSlider && speedValue) {
        speedSlider.addEventListener("input", () => {
            const value = speedSlider.value;
            speedValue.textContent = `${value}ms`;
            ExperimentState.settings.speed = parseInt(value);
            if (ExperimentState.isRunning) { // isRunning 상태를 확인해야 함
                ExperimentController.stopAutoRun();
                ExperimentController.startAutoRun();
            }
        });
    }

    const startExperimentBtn = document.getElementById("start-experiment-btn");
    if (startExperimentBtn) {
        startExperimentBtn.addEventListener("click", () => {
            const experimentTabBtn = document.querySelector('[data-tab="experiment"]');
            if (experimentTabBtn) {
                experimentTabBtn.click(); // 탭 전환 (여기서 차트 초기화가 트리거될 것임)
            }
        });
    }
    
    // 통계보기 버튼 이벤트 리스너 추가
    const viewStatsBtn = document.getElementById("view-stats-btn");
    if (viewStatsBtn) {
        viewStatsBtn.addEventListener("click", () => {
            const statisticsTabBtn = document.querySelector('[data-tab="statistics"]');
            if (statisticsTabBtn) {
                statisticsTabBtn.click(); // 통계 탭으로 전환
            }
        });
    }
  },

  /**
   * 토스트 알림 컨트롤 초기화
   */
  initializeToastControls() {
    const toastClose = document.querySelector(".toast-close");
    // toastClose 요소가 없을 수도 있으므로 null 체크 추가
    if (toastClose) {
        toastClose.addEventListener("click", () => {
            const toast = document.getElementById("toast-message");
            if (toast) { // toast 요소도 null 체크
                toast.classList.remove("show", "success", "error", "warning", "info");
            }
        });
    }
  },

  /**
   * 버튼 상태 업데이트
   * @param {boolean} isRunning - 실험 실행 중 여부
   */
  updateButtonStates(isRunning) {
    ExperimentState.isRunning = isRunning;

    const buttons = {
      runBtn: document.querySelector(".run-btn"),
      autoBtn: document.querySelector(".auto-btn"),
      stopBtn: document.querySelector(".stop-btn"),
      resetBtn: document.querySelector(".reset-btn"),
    };

    // 입력 필드
    const kInput = document.getElementById("k");
    const speedSlider = document.getElementById("speed-slider");

    // 실행 중일 때 버튼 상태 설정
    buttons.autoBtn.disabled = isRunning;
    buttons.stopBtn.disabled = !isRunning;

    // 실행 중일 때 실행 버튼 및 리셋 버튼 스타일 변경
    buttons.runBtn.style.opacity = isRunning ? "0.5" : "1";
    buttons.resetBtn.style.opacity = isRunning ? "0.5" : "1";

    // 입력 필드 비활성화
    kInput.disabled = isRunning;

    // 애니메이션 효과 추가
    buttons.autoBtn.classList.toggle("disabled", isRunning);
    buttons.stopBtn.classList.toggle("disabled", !isRunning);
  },

  /**
   * 동전 영역 렌더링
   * @param {Array} coins - 동전 배열
   * @param {boolean} isSuccess - 실험 성공 여부
   */
  renderCoins(coins, isSuccess) {
    const coinArea = document.getElementById("coin-area");
    const k = coins.length;

    // 기존 동전 지우기
    coinArea.innerHTML = "";

    // 동전 개수에 따라 행 크기 조정
    const coinsPerRow = k <= 20 ? 10 : k <= 40 ? 15 : 20;

    // 동전 행 생성
    for (let i = 0; i < k; i += coinsPerRow) {
      const row = document.createElement("div");
      row.className = "coin-row";

      const rowCoins = coins.slice(i, i + coinsPerRow);

      // 행 안의 동전 생성
      rowCoins.forEach((coinValue, index) => {
        const coin = document.createElement("div");
        coin.className = "coin";

        // 동전 내용 - 배치된 숫자만 표시
        coin.innerHTML = `<span>${coinValue}</span>`;

        // 원래 위치에 있는 동전은 실패 표시
        const originalPos = i + index + 1;
        if (coinValue === originalPos) {
          coin.classList.add("fail");
          coin.setAttribute(
            "title",
            `동전 ${originalPos}이(가) 제자리에 있습니다`
          );
        } else {
          coin.setAttribute(
            "title",
            `동전 ${originalPos}이(가) 위치 ${coinValue}에 있습니다`
          );
        }

        row.appendChild(coin);
      });

      coinArea.appendChild(row);
    }

    // 성공 시 애니메이션 효과
    if (isSuccess) {
      setTimeout(() => {
        document.querySelectorAll(".coin").forEach((coin) => {
          coin.classList.add("success");
        });
      }, 500);
    }
  },

  /**
   * 결과 박스 업데이트
   */
  updateResultBox() {
    const resultBox = document.getElementById("result");
    const fraction = `${ExperimentState.successCount} / ${ExperimentState.totalTrials}`;
    const decimal = Utils.formatNumber(
      ExperimentState.successCount / ExperimentState.totalTrials
    );
    const difference = Math.abs(
      parseFloat(decimal) - parseFloat(ExperimentState.constants.oneOverE)
    ).toFixed(6);

    resultBox.innerHTML = `
      <h2>✅ 성공 확률: ${fraction} = ${decimal}</h2>
      <p>ℹ️ 자연상수 e ≈ ${ExperimentState.constants.e}, 1/e ≈ ${ExperimentState.constants.oneOverE}</p>
      <p>⚖️ 이론값과의 차이: ${difference}</p>
    `;

    // 결과 박스가 숨겨져 있으면 표시
    if (resultBox.classList.contains("result-hidden")) {
      resultBox.classList.remove("result-hidden");
    }

    // 애니메이션 효과
    Utils.toggleClassWithAnimation(resultBox, "pulse");
  },

  /**
   * 실험 통계 업데이트
   */
  updateStatistics() {
    const totalTrialsEl = document.getElementById("total-trials");
    const successCountEl = document.getElementById("success-count");
    const successRateEl = document.getElementById("success-rate");
    const theoreticalValueEl = document.getElementById("theoretical-value");
    // 상세 통계용 요소들
    const statsTotalTrialsEl = document.getElementById("stats-total-trials");
    const statsSuccessCountEl = document.getElementById("stats-success-count");
    const statsSuccessRateEl = document.getElementById("stats-success-rate");
    const statsTheoreticalEl = document.getElementById("stats-theoretical");
    const statsDifferenceEl = document.getElementById("stats-difference");
    const statsMaxStreakEl = document.getElementById("stats-max-streak");
    const statsMaxFailStreakEl = document.getElementById("stats-max-fail-streak");

    const rate = ExperimentState.totalTrials > 0 ? ExperimentState.successCount / ExperimentState.totalTrials : 0;
    const formattedRate = Utils.formatNumber(rate);
    const difference = ExperimentState.totalTrials > 0 ? Math.abs(rate - parseFloat(ExperimentState.constants.oneOverE)).toFixed(6) : "0.0000";

    if (totalTrialsEl) totalTrialsEl.textContent = ExperimentState.totalTrials;
    if (successCountEl) successCountEl.textContent = ExperimentState.successCount;
    if (successRateEl) successRateEl.textContent = formattedRate;
    if (theoreticalValueEl) theoreticalValueEl.textContent = ExperimentState.constants.oneOverE;

    if (statsTotalTrialsEl) statsTotalTrialsEl.textContent = ExperimentState.totalTrials;
    if (statsSuccessCountEl) statsSuccessCountEl.textContent = ExperimentState.successCount;
    if (statsSuccessRateEl) statsSuccessRateEl.textContent = formattedRate;
    if (statsTheoreticalEl) statsTheoreticalEl.textContent = ExperimentState.constants.oneOverE;
    if (statsDifferenceEl) statsDifferenceEl.textContent = difference;
    if (statsMaxStreakEl) statsMaxStreakEl.textContent = ExperimentState.streakData.maxSuccessStreak;
    if (statsMaxFailStreakEl) statsMaxFailStreakEl.textContent = ExperimentState.streakData.maxFailStreak;
  },
};

// 함수 정의: 파일 상단 혹은 외부에서 따로 정의
function updateAllStats() {
  const rate = getSuccessRate();
  const diff = Math.abs(rate - ExperimentState.constants.oneOverE).toFixed(6);
  document.querySelectorAll("#success-rate, #stats-success-rate").forEach(el => el.textContent = rate.toFixed(4));
  document.getElementById("stats-difference").textContent = diff;
}

function getSuccessRate() {
  const { totalTrials, successCount } = ExperimentState;
  return totalTrials > 0 ? successCount / totalTrials : 0;
}

// 실험 컨트롤러
const ExperimentController = {
  /**
   * 입력값 검증
   * @returns {boolean} - 검증 성공 여부
   */
  validateInput() {
    const kInput = document.getElementById("k");
    const errorMessage = document.getElementById("error-message");
    const value = parseInt(kInput.value);

    if (
      isNaN(value) ||
      value < 1 ||
      value > ExperimentState.settings.maxCoins
    ) {
      errorMessage.style.display = "block";
      errorMessage.textContent = `1에서 ${ExperimentState.settings.maxCoins} 사이의 숫자를 입력해주세요.`;
      Utils.showToast(
        `1에서 ${ExperimentState.settings.maxCoins} 사이의 숫자를 입력해주세요.`,
        "error"
      );
      return false;
    }

    errorMessage.style.display = "none";
    return true;
  },

  /**
   * 실험 실행
   */
  runTest() {
    if (!this.validateInput()) return;

    const k = parseInt(document.getElementById("k").value);

    // 동전 섞기
    let coins = Utils.shuffle([...Array(k).keys()].map((i) => i + 1));
    let isSuccess = true;
    let inPlaceCoins = [];

    // 동전이 제자리에 있는지 확인
    for (let i = 0; i < k; i++) {
      if (coins[i] === i + 1) {
        isSuccess = false;
        inPlaceCoins.push(i + 1);

        // 동전 위치 통계 업데이트
        ExperimentState.coinPositionStats[i + 1] =
          (ExperimentState.coinPositionStats[i + 1] || 0) + 1;
      }
    }

    // 결과 처리
    if (isSuccess) {
      ExperimentState.successCount++;
      ExperimentState.streakData.currentSuccessStreak++;
      ExperimentState.streakData.currentFailStreak = 0;

      // 최대 연속 성공 업데이트
      if (
        ExperimentState.streakData.currentSuccessStreak >
        ExperimentState.streakData.maxSuccessStreak
      ) {
        ExperimentState.streakData.maxSuccessStreak =
          ExperimentState.streakData.currentSuccessStreak;
      }
    } else {
      ExperimentState.streakData.currentFailStreak++;
      ExperimentState.streakData.currentSuccessStreak = 0;

      // 최대 연속 실패 업데이트
      if (
        ExperimentState.streakData.currentFailStreak >
        ExperimentState.streakData.maxFailStreak
      ) {
        ExperimentState.streakData.maxFailStreak =
          ExperimentState.streakData.currentFailStreak;
      }
    }

    // 실험 횟수 증가
    ExperimentState.totalTrials++;

    // 실험 결과 저장
    ExperimentState.experimentResults.push({
      trial: ExperimentState.totalTrials,
      success: isSuccess,
      coinCount: k,
      inPlaceCoins: inPlaceCoins,
    });

    // UI 업데이트
    UIManager.renderCoins(coins, isSuccess);
    UIManager.updateResultBox();
    UIManager.updateStatistics(); // 통계 업데이트
    
    // 차트 업데이트 - 이 부분이 누락되어 있었습니다
    ChartManager.updateAllCharts();
  },

  /**
   * 자동 실행 시작
   */
  startAutoRun() {
    if (ExperimentState.intervalId !== null) return;
    if (!this.validateInput()) return;

    ExperimentState.intervalId = setInterval(() => {
      this.runTest();
    }, ExperimentState.settings.speed);

    UIManager.updateButtonStates(true);
  },

  /**
   * 자동 실행 정지
   */
  stopAutoRun() {
    clearInterval(ExperimentState.intervalId);
    ExperimentState.intervalId = null;
    UIManager.updateButtonStates(false);
  },

  /**
   * 실험 초기화
   */
  reset() {
    this.stopAutoRun();
    ExperimentState.totalTrials = 0;
    ExperimentState.successCount = 0;
    ExperimentState.experimentResults = [];
    ExperimentState.coinPositionStats = {};
    ExperimentState.streakData = {
      currentSuccessStreak: 0,
      currentFailStreak: 0,
      maxSuccessStreak: 0,
      maxFailStreak: 0,
    };

    if (ExperimentState.chart) {
      ExperimentState.chart.data.labels = [];
      ExperimentState.chart.data.datasets[0].data = [];
      ExperimentState.chart.data.datasets[1].data = [];
      ExperimentState.chart.update();
    }

    if (ExperimentState.distributionChart) {
      ExperimentState.distributionChart.data.labels = [];
      ExperimentState.distributionChart.data.datasets[0].data = [];
      ExperimentState.distributionChart.update();
    }

    document.getElementById("coin-area").innerHTML = "";
    document.getElementById("result").classList.add("result-hidden");
    UIManager.updateStatistics();
  },
};

function decrementValue() {
  const input = document.getElementById("k");
  if (input.value > 1) {
    input.value = parseInt(input.value) - 1;
  }
}

function incrementValue() {
  const input = document.getElementById("k");
  if (input.value < ExperimentState.settings.maxCoins) {
    input.value = parseInt(input.value) + 1;
  }
}

// DOMContentLoaded 이벤트 리스너
window.addEventListener("DOMContentLoaded", () => {
  UIManager.initialize();
  // ChartManager.initializeMainChart(); // UIManager.initialize 내부 또는 탭 활성화 시로 이동
  // ChartManager.initializeDistributionChart(); // UIManager.initialize 내부 또는 탭 활성화 시로 이동
});
