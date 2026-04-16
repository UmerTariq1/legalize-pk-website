const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// Update Nav Active State
html = html.replace('<a href="/" data-nav-key="home">Home</a>', '<a href="/" data-nav-key="home" class="is-active" aria-current="page">Home</a>');

// Overhaul Main Container
const mainStart = html.indexOf('<main class="page">');
const mainEnd = html.indexOf('</main>') + 7;

if (mainStart !== -1) {
  const newMain = `
      <main class="page">
        <section class="hero" style="display: grid; grid-template-columns: 1.15fr 0.85fr; gap: var(--space-6); align-items: center; margin-bottom: 80px;">
          <div>
            <p class="page-kicker" data-animate>Public Constitutional Record</p>
            <h1 class="page-title hero__title" data-animate style="margin: 8px 0; font-weight: 800; font-size: clamp(38px, 5vw + 1rem, 72px); line-height: 1.1;">
              Navigate Pakistan's Constitution as a <br/><em style="font-style: italic; color: var(--text-gold);">living timeline.</em>
            </h1>
            <p class="hero__lead" data-animate style="font-size: 18px; line-height: 1.6; max-width: 600px; color: var(--text-primary); margin: 24px 0;">
              Legalize PK transforms constitutional amendments into a browsable civic archive. Follow article changes,
              compare snapshots, and understand amendments in plain language.
            </p>
            <div class="stat-grid" data-animate style="display: flex; gap: 12px; flex-wrap: wrap; margin: 32px 0;">
              <span class="badge badge--gold" data-stat="amendments" style="background: var(--surface-2-pale); border: 1px solid var(--text-gold); color: var(--text-gold); padding: 8px 16px; border-radius: 9999px;">Loading amendments...</span>
              <span class="badge" data-stat="articles" style="background: var(--surface-2-cream); border: 1px solid var(--text-gold); color: var(--text-gold); padding: 8px 16px; border-radius: 9999px;">Loading articles...</span>
              <span class="badge badge--success" data-stat="years" style="background: var(--surface-2-pale); border: 1px solid var(--text-gold); color: var(--text-gold); padding: 8px 16px; border-radius: 9999px;">Loading timeline...</span>
            </div>
            <a href="/explore" class="btn-primary" style="display: inline-flex; align-items: center; margin-top: 16px; text-decoration: none;">Get Started <i data-lucide="arrow-right" style="margin-left: 8px; width: 18px;"></i></a>
            <p class="page-subtitle" data-generated-at data-animate style="margin-top: 16px; font-size: 13px; color: #666;"></p>
          </div>

          <div class="hero-media-grid" data-animate style="position: relative; width: 100%; max-width: 480px; margin: 0 auto; min-height: 380px;">
            <div class="hero-media-frame" aria-hidden="true" style="position: absolute; top: 0; right: 0; bottom: 0; left: 24px; border-radius: 20px; overflow: hidden; box-shadow: 8px 10px 0px var(--text-gold), 16px 20px 0px rgba(27, 94, 32, 0.25);">
              <img class="hero-media-image" src="assets/images/hero-courthouse.png" alt="" loading="eager" decoding="async" />
            </div>
            <div class="overlay-info-card card" style="position: absolute; bottom: -24px; left: -16px; width: 280px; padding: 24px; background: var(--surface-1); box-shadow: var(--shadow-tilt); z-index: 10;">
              <p style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: var(--text-gold); margin: 0 0 8px 0; letter-spacing: 0.1em;">repository-backed</p>
              <p style="margin: 0; font-size: 15px; line-height: 1.5; color: var(--text-primary); font-weight: 500;">Every article is versioned in markdown. Every enacted amendment is a dated commit.</p>
            </div>
          </div>
        </section>

        <section class="card-grid home-nav-cards" aria-label="Main navigation cards" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 24px; margin-bottom: 64px;">
          <article class="card nav-card" style="background: var(--surface-2-pale); border-top: 5px solid var(--text-gold); border-radius: var(--radius-m); transition: all var(--transition-fast);">
            <i data-lucide="book-open" style="width: 32px; height: 32px; color: var(--text-gold); margin-bottom: 16px; display: block;"></i>
            <h3 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 700;">Current Constitution</h3>
            <p style="margin: 0 0 24px 0; line-height: 1.6; color: var(--text-primary);">Read all article texts with amendment metadata and expandable rows.</p>
            <a href="/constitution" style="color: var(--text-gold); font-weight: 600; display: inline-flex; align-items: center; gap: 6px; text-decoration: none; border-bottom: 1px transparent; padding-bottom: 2px;">Open Constitution <i data-lucide="arrow-right" style="width: 16px; height: 16px;"></i></a>
          </article>
          
          <article class="card nav-card" style="background: var(--surface-1); border-top: 5px solid var(--surface-2-bottle); border-radius: var(--radius-m); transition: all var(--transition-fast);">
            <i data-lucide="compass" style="width: 32px; height: 32px; color: var(--text-gold); margin-bottom: 16px; display: block;"></i>
            <h3 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 700;">Explore Paths</h3>
            <p style="margin: 0 0 24px 0; line-height: 1.6; color: var(--text-primary);">Jump directly to article history, amendment details, or side-by-side evolution.</p>
            <a href="/explore" style="color: var(--text-gold); font-weight: 600; display: inline-flex; align-items: center; gap: 6px; text-decoration: none;">Open Explorer <i data-lucide="arrow-right" style="width: 16px; height: 16px;"></i></a>
          </article>

          <article class="card nav-card" style="background: #FFF8E7; border-top: 5px solid var(--border-dark); border-radius: var(--radius-m); transition: all var(--transition-fast);">
            <i data-lucide="git-commit" style="width: 32px; height: 32px; color: var(--text-gold); margin-bottom: 16px; display: block;"></i>
            <h3 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 700;">Constitution Timeline</h3>
            <p style="margin: 0 0 24px 0; line-height: 1.6; color: var(--text-primary);">See constitutional events across decades and filter by your lifetime date range.</p>
            <a href="/timeline" style="color: var(--text-gold); font-weight: 600; display: inline-flex; align-items: center; gap: 6px; text-decoration: none;">Open Timeline <i data-lucide="arrow-right" style="width: 16px; height: 16px;"></i></a>
          </article>

          <article class="card nav-card" style="background: var(--surface-1); border-top: 5px solid var(--text-gold); border-radius: var(--radius-m); transition: all var(--transition-fast);">
            <i data-lucide="search" style="width: 32px; height: 32px; color: var(--text-gold); margin-bottom: 16px; display: block;"></i>
            <h3 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 700;">Global Search</h3>
            <p style="margin: 0 0 24px 0; line-height: 1.6; color: var(--text-primary);">Search by article number, amendment number, topics, and terms.</p>
            <a href="/search" style="color: var(--text-gold); font-weight: 600; display: inline-flex; align-items: center; gap: 6px; text-decoration: none;">Open Search <i data-lucide="arrow-right" style="width: 16px; height: 16px;"></i></a>
          </article>
        </section>

        <section class="card" data-home-callout aria-label="Editorial callout" style="background: #FFF8E7; border-left: 6px solid var(--text-gold); padding: 32px; margin-bottom: 64px;">
            <p style="font-size: 13px; text-transform: uppercase; letter-spacing: 0.15em; color: var(--text-gold); font-weight: 700; margin: 0 0 12px 0;">DID YOU KNOW?</p>
            <h3 style="margin: 0 0 12px 0; font-size: 24px; font-weight: 700; color: var(--text-primary);">The 18th Amendment</h3>
            <p style="margin: 0; line-height: 1.6; font-size: 16px; color: var(--text-primary); max-width: 800px;">Passed in 2010, the 18th Amendment removed the power of the President of Pakistan to dissolve the Parliament unilaterally, turning Pakistan from a semi-presidential to a parliamentary republic, and renaming North-West Frontier Province to Khyber Pakhtunkhwa.</p>
        </section>

        <section class="github-band" style="background: var(--surface-2-bottle); color: #FFFFFF; border-radius: 12px; padding: 40px 48px; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 32px;">
          <div style="flex: 1; min-width: 300px;">
            <p style="font-size: 24px; font-weight: 700; margin: 0 0 8px 0; color: #FFFFFF;">Open Data Source</p>
            <p style="margin: 0; font-size: 16px; line-height: 1.6; opacity: 0.9; color: #FFFFFF;">This site is powered by a public Git repository. Every amendment is a commit.</p>
          </div>
          <a href="https://github.com/UmerTariq1/legalize-pk" target="_blank" rel="noopener" class="btn-ghost" style="border-color: var(--text-gold); color: var(--text-gold); text-decoration: none; padding: 12px 24px; display: inline-flex; align-items: center;">
            <i data-lucide="github" style="width: 20px; height: 20px; margin-right: 8px;"></i> View Repository
          </a>
        </section>
      </main>`;
  
  html = html.slice(0, mainStart) + newMain + html.slice(mainEnd);
}

fs.writeFileSync('index.html', html);
console.log('Homepage updated successfully.');
