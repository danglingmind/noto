"use client";

/*
  VYNL — landing page redesign (dark, card-free, scroll-driven)
  Drop this file at: app/page.jsx  (Next.js App Router, no extra deps)
*/

import { useEffect, useRef } from "react";

export default function LandingV2() {
  const rootRef = useRef(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cleanups = [];

    /* ---------- web-audio: synthesized rubber-stamp thud ---------- */
    let audioCtx = null;
    const AC =
      typeof window !== "undefined" &&
      (window.AudioContext || window.webkitAudioContext);
    const UNLOCK_EVENTS = [
      "pointerdown",
      "mousedown",
      "keydown",
      "touchstart",
      "wheel",
      "scroll",
    ];
    const unlockAudio = () => {
      if (!AC) return;
      if (!audioCtx) audioCtx = new AC();
      if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
    };
    UNLOCK_EVENTS.forEach((ev) =>
      window.addEventListener(ev, unlockAudio, { passive: true })
    );
    cleanups.push(() =>
      UNLOCK_EVENTS.forEach((ev) => window.removeEventListener(ev, unlockAudio))
    );
    const buildStamp = (ctx) => {
      const t = ctx.currentTime;
      const master = ctx.createGain();
      master.gain.value = 0.85;
      master.connect(ctx.destination);

      /* impact — filtered noise burst (felt/paper slap) */
      const nDur = 0.09;
      const buf = ctx.createBuffer(
        1,
        Math.floor(ctx.sampleRate * nDur),
        ctx.sampleRate
      );
      const chan = buf.getChannelData(0);
      for (let i = 0; i < chan.length; i++)
        chan[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / chan.length, 2.2);
      const noise = ctx.createBufferSource();
      noise.buffer = buf;
      const nf = ctx.createBiquadFilter();
      nf.type = "lowpass";
      nf.frequency.value = 1900;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.55, t);
      ng.gain.exponentialRampToValueAtTime(0.001, t + nDur);
      noise.connect(nf).connect(ng).connect(master);
      noise.start(t);
      noise.stop(t + nDur);

      /* body — low pitched thud */
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(170, t);
      osc.frequency.exponentialRampToValueAtTime(48, t + 0.15);
      const og = ctx.createGain();
      og.gain.setValueAtTime(0.0001, t);
      og.gain.exponentialRampToValueAtTime(0.9, t + 0.007);
      og.gain.exponentialRampToValueAtTime(0.001, t + 0.19);
      osc.connect(og).connect(master);
      osc.start(t);
      osc.stop(t + 0.2);

      /* top — sharp wooden click */
      const click = ctx.createOscillator();
      click.type = "square";
      click.frequency.value = 2500;
      const cg = ctx.createGain();
      cg.gain.setValueAtTime(0.1, t);
      cg.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
      click.connect(cg).connect(master);
      click.start(t);
      click.stop(t + 0.03);
    };
    const playStamp = () => {
      if (reduce || !AC) return;
      if (!audioCtx) audioCtx = new AC();
      const ctx = audioCtx;
      if (ctx.state === "suspended") {
        ctx
          .resume()
          .then(() => buildStamp(ctx))
          .catch(() => {});
      } else {
        buildStamp(ctx);
      }
    };

    /* ---------- scroll progress bar ---------- */
    const bar = root.querySelector(".progress");
    const onProg = () => {
      const h = document.documentElement;
      const p = h.scrollTop / (h.scrollHeight - h.clientHeight);
      if (bar) bar.style.transform = `scaleX(${p})`;
    };
    window.addEventListener("scroll", onProg, { passive: true });
    onProg();
    cleanups.push(() => window.removeEventListener("scroll", onProg));

    /* ---------- reveal on scroll ---------- */
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          e.target.classList.add("in");

          /* count-up numbers */
          e.target.querySelectorAll("[data-count]").forEach((c) => {
            if (c.dataset.done) return;
            c.dataset.done = "1";
            const target = parseInt(c.getAttribute("data-count"), 10);
            if (reduce) { c.textContent = target; return; }
            let start = null;
            const dur = 1200;
            const tick = (ts) => {
              if (!start) start = ts;
              let p = Math.min((ts - start) / dur, 1);
              p = 1 - Math.pow(1 - p, 3);
              c.textContent = Math.round(target * p);
              if (p < 1) requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
          });
          io.unobserve(e.target);
        }),
      { threshold: 0.22 }
    );
    root.querySelectorAll(".io").forEach((el) => io.observe(el));
    cleanups.push(() => io.disconnect());

    /* ---------- hero parallax pins ---------- */
    const floats = root.querySelectorAll("[data-float]");
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const y = window.scrollY;
        floats.forEach((el) => {
          const s = parseFloat(el.dataset.float);
          el.style.transform = `translateY(${y * s}px) rotate(${y * s * 0.05}deg)`;
        });
      });
    };
    if (!reduce) {
      window.addEventListener("scroll", onScroll, { passive: true });
      cleanups.push(() => window.removeEventListener("scroll", onScroll));
    }

    /* ---------- how-it-works: smooth scroll-driven progress line ---------- */
    const steps = [...root.querySelectorAll(".step")];
    const railFill = root.querySelector(".rail-fill");
    const railEl = root.querySelector(".rail");
    const hiwRight = root.querySelector(".hiw-right");
    if (steps.length && railFill) {
      const DOT = 60; /* .step::before center: top(52) + half height(8) */
      let rafRail = 0;
      const stamp = root.querySelector(".stamp");
      let stampFired = false;
      const updateRail = () => {
        /* a "playhead" line fixed at 55% of the viewport height */
        const anchor = window.innerHeight * 0.55;
        const firstDot = steps[0].getBoundingClientRect().top + DOT;
        const lastDot =
          steps[steps.length - 1].getBoundingClientRect().top + DOT;
        /* span the rail exactly from the first dot to the last dot */
        if (railEl && hiwRight) {
          const hrTop = hiwRight.getBoundingClientRect().top;
          railEl.style.top = `${firstDot - hrTop}px`;
          railEl.style.bottom = "auto";
          railEl.style.height = `${lastDot - firstDot}px`;
        }
        const span = lastDot - firstDot;
        let p = span > 0 ? (anchor - firstDot) / span : 0;
        p = Math.max(0, Math.min(1, p));
        railFill.style.height = `${p * 100}%`;
        /* light each step as the playhead reaches its dot */
        steps.forEach((s) => {
          const dotY = s.getBoundingClientRect().top + DOT;
          s.classList.toggle("live", dotY <= anchor + 6);
        });
        /* slam the APPROVED stamp exactly when the last dot joins the line */
        if (!stampFired && stamp && lastDot <= anchor + 6) {
          stampFired = true;
          stamp.classList.add("slam");
          setTimeout(playStamp, 250);
        }
      };
      const onRail = () => {
        cancelAnimationFrame(rafRail);
        rafRail = requestAnimationFrame(updateRail);
      };
      window.addEventListener("scroll", onRail, { passive: true });
      window.addEventListener("resize", onRail);
      updateRail();
      cleanups.push(() => {
        cancelAnimationFrame(rafRail);
        window.removeEventListener("scroll", onRail);
        window.removeEventListener("resize", onRail);
      });
    }

    /* ---------- interactive canvas: click to drop a pin ---------- */
    const stage = root.querySelector(".stage");
    if (stage) {
      const colors = ["p-yellow", "p-red", "p-blue", "p-green"];
      const msgs = [
        "Nice pin. That\u2019s literally the whole product.",
        "Your clients do this \u2014 no account needed.",
        "Feedback, exactly where it belongs.",
        "Faster than typing an email, right?",
      ];
      let n = 0;
      const onClick = (ev) => {
        if (ev.target.closest(".pin")) return;
        const r = stage.getBoundingClientRect();
        const x = ((ev.clientX - r.left) / r.width) * 100;
        const y = ((ev.clientY - r.top) / r.height) * 100;
        const pin = document.createElement("div");
        pin.className =
          "pin user show " + colors[n % 4] + (x > 55 ? " flip" : "");
        pin.style.left = x + "%";
        pin.style.top = y + "%";
        pin.innerHTML =
          `<span class="inner landed"><span class="head"><i>${n + 4}</i></span></span>` +
          `<span class="bubble"><b>YOU \u00b7 REVIEWER</b>${msgs[n % 4]}</span>`;
        stage.appendChild(pin);
        setTimeout(() => pin.classList.remove("show"), 2600);
        const olds = stage.querySelectorAll(".pin.user");
        if (olds.length > 5) olds[0].remove();
        n++;
      };
      stage.addEventListener("click", onClick);
      cleanups.push(() => stage.removeEventListener("click", onClick));
    }

    /* ---------- magnetic CTA + pin confetti ---------- */
    root.querySelectorAll(".magnet").forEach((btn) => {
      const move = (e) => {
        if (reduce) return;
        const r = btn.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        btn.style.transform = `translate(${dx * 0.18}px, ${dy * 0.3}px)`;
      };
      const leave = () => (btn.style.transform = "");
      btn.addEventListener("mousemove", move);
      btn.addEventListener("mouseleave", leave);
      cleanups.push(() => {
        btn.removeEventListener("mousemove", move);
        btn.removeEventListener("mouseleave", leave);
      });
    });

    const burst = (e) => {
      if (reduce) return;
      const btn = e.currentTarget;
      const r = btn.getBoundingClientRect();
      const cols = ["#FFE14D", "#FF5A36", "#7C97FF", "#3BDA82"];
      for (let i = 0; i < 26; i++) {
        const p = document.createElement("span");
        p.className = "confetti-pin";
        p.style.left = r.left + r.width / 2 + "px";
        p.style.top = r.top + r.height / 2 + "px";
        p.style.background = cols[i % 4];
        document.body.appendChild(p);
        const a = (Math.PI * 2 * i) / 26 + Math.random() * 0.4;
        const v = 90 + Math.random() * 160;
        p.animate(
          [
            { transform: "translate(0,0) rotate(-45deg) scale(1)", opacity: 1 },
            {
              transform: `translate(${Math.cos(a) * v}px, ${
                Math.sin(a) * v - 60 + Math.random() * 120
              }px) rotate(${Math.random() > 0.5 ? 320 : -320}deg) scale(0)`,
              opacity: 0,
            },
          ],
          { duration: 900 + Math.random() * 500, easing: "cubic-bezier(.2,.7,.3,1)" }
        ).onfinish = () => p.remove();
      }
    };
    root.querySelectorAll(".burst").forEach((b) => {
      b.addEventListener("click", burst);
      cleanups.push(() => b.removeEventListener("click", burst));
    });

    /* ---------- FAQ ---------- */
    root.querySelectorAll(".qa > button").forEach((btn) => {
      const onQ = () => {
        const qa = btn.parentElement;
        const ans = qa.querySelector(".ans");
        const open = qa.classList.contains("open");
        root.querySelectorAll(".qa.open").forEach((o) => {
          o.classList.remove("open");
          o.querySelector(".ans").style.maxHeight = null;
          o.querySelector("button").setAttribute("aria-expanded", "false");
        });
        if (!open) {
          qa.classList.add("open");
          ans.style.maxHeight = ans.scrollHeight + "px";
          btn.setAttribute("aria-expanded", "true");
        }
      };
      btn.addEventListener("click", onQ);
      cleanups.push(() => btn.removeEventListener("click", onQ));
    });

    /* ---------- surprise: logo pin rains pins ---------- */
    const logo = root.querySelector(".logo-pin");
    if (logo) {
      const rain = () => {
        if (reduce) return;
        const cols = ["#FFE14D", "#FF5A36", "#7C97FF", "#3BDA82"];
        for (let i = 0; i < 14; i++) {
          const p = document.createElement("span");
          p.className = "confetti-pin";
          p.style.left = Math.random() * window.innerWidth + "px";
          p.style.top = "-30px";
          p.style.background = cols[i % 4];
          document.body.appendChild(p);
          p.animate(
            [
              { transform: "translateY(0) rotate(-45deg)", opacity: 1 },
              {
                transform: `translateY(${window.innerHeight + 60}px) rotate(${
                  Math.random() * 500 - 250
                }deg)`,
                opacity: 0.9,
              },
            ],
            {
              duration: 1400 + Math.random() * 1200,
              easing: "cubic-bezier(.4,0,.8,1)",
              delay: Math.random() * 300,
            }
          ).onfinish = () => p.remove();
        }
      };
      logo.addEventListener("click", rain);
      cleanups.push(() => logo.removeEventListener("click", rain));
    }

    /* ---------- feature-row signature hovers ---------- */
    root.querySelectorAll(".row[data-fx]").forEach((rowEl) => {
      const fx = rowEl.dataset.fx;

      /* real-time collaboration — live multiplayer cursors */
      if (fx === "collab") {
        const people = [
          { name: "Sarah", c: "#FF5A36" },
          { name: "Dev", c: "#7C97FF" },
          { name: "You", c: "#3BDA82" },
        ];
        let live = [];
        const enter = () => {
          if (reduce || live.length) return;
          const r = rowEl.getBoundingClientRect();
          people.forEach((p, i) => {
            const el = document.createElement("div");
            el.className = "fx-cursor";
            el.innerHTML =
              `<svg viewBox="0 0 24 24" fill="${p.c}"><path d="M4 2l6.5 17 2.4-6.9 6.9-2.4z"/></svg>` +
              `<b style="background:${p.c}">${p.name}</b>`;
            rowEl.appendChild(el);
            live.push(el);
            const x0 = r.width * (0.15 + Math.random() * 0.6);
            const y0 = r.height * Math.random();
            const x1 = r.width * (0.15 + Math.random() * 0.6);
            const y1 = r.height * Math.random();
            el.style.transform = `translate(${x0}px, ${y0}px)`;
            requestAnimationFrame(() => el.classList.add("on"));
            el.animate(
              [
                { transform: `translate(${x0}px, ${y0}px)` },
                { transform: `translate(${x1}px, ${y1}px)` },
                { transform: `translate(${x0}px, ${y0}px)` },
              ],
              {
                duration: 2600 + i * 700,
                iterations: Infinity,
                easing: "ease-in-out",
                delay: i * 130,
              }
            );
          });
        };
        const leave = () => {
          live.forEach((el) => {
            el.classList.remove("on");
            setTimeout(() => el.remove(), 300);
          });
          live = [];
        };
        rowEl.addEventListener("mouseenter", enter);
        rowEl.addEventListener("mouseleave", leave);
        cleanups.push(() => {
          rowEl.removeEventListener("mouseenter", enter);
          rowEl.removeEventListener("mouseleave", leave);
          leave();
        });
      }

      /* contextual comments — a comment pin trails the cursor */
      if (fx === "comment") {
        const follow = document.createElement("div");
        follow.className = "fx-follow";
        follow.innerHTML =
          `<span class="fx-follow-head"></span>` +
          `<span class="fx-follow-bubble">pin a comment right here</span>`;
        rowEl.appendChild(follow);
        const move = (ev) => {
          const r = rowEl.getBoundingClientRect();
          follow.style.transform = `translate(${ev.clientX - r.left}px, ${
            ev.clientY - r.top
          }px)`;
        };
        const enter = () => follow.classList.add("on");
        const leave = () => follow.classList.remove("on");
        rowEl.addEventListener("mousemove", move);
        rowEl.addEventListener("mouseenter", enter);
        rowEl.addEventListener("mouseleave", leave);
        cleanups.push(() => {
          rowEl.removeEventListener("mousemove", move);
          rowEl.removeEventListener("mouseenter", enter);
          rowEl.removeEventListener("mouseleave", leave);
          follow.remove();
        });
      }
    });

    /* ---------- initial hero sequence ---------- */
    const t = setTimeout(() => {
      root.classList.remove("pre");
      root.classList.add("loaded");
    }, reduce ? 0 : 120);
    cleanups.push(() => clearTimeout(t));

    return () => cleanups.forEach((fn) => fn());
  }, []);

  return (
    <main ref={rootRef} className="vynl pre">
      <link rel="preconnect" href="https://api.fontshare.com" />
      <link
        href="https://api.fontshare.com/v2/css?f[]=cabinet-grotesk@500,700,800&f[]=switzer@400,500,600&display=swap"
        rel="stylesheet"
      />
      <link
        href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap"
        rel="stylesheet"
      />

      <span className="progress" aria-hidden="true" />
      <nav>
        <div className="nav-in">
          <a className="logo" href="#" aria-label="VYNL home">
            <img className="logo-pin" src="/vynl-logo.png" alt="" />
            VYNL
          </a>
          <div className="nav-links">
            <a href="#features">Features</a>
            <a href="#pricing">Pricing</a>
            <a href="https://vynl.in/blogs">Blog</a>
            <a href="https://vynl.in/support">Support</a>
          </div>
          <div className="nav-cta">
            <a className="signin" href="https://vynl.in/sign-in">Sign in</a>
            <a className="btn sm" href="https://vynl.in/sign-up">Try Free</a>
          </div>
        </div>
      </nav>

      {/* ================= HERO ================= */}
      <header className="hero">
        <span className="float f1" data-float="-0.12" aria-hidden="true" />
        <span className="float f2" data-float="0.09" aria-hidden="true" />
        <span className="float f3" data-float="-0.06" aria-hidden="true" />
        <div className="wrap">
          <h1>
            <span className="line"><span className="line-in">Stop <span className="strike">chasing<svg viewBox="0 0 300 40" preserveAspectRatio="none"><path d="M4 22 C 60 12, 120 30, 170 18 S 270 24, 296 16" /></svg></span></span></span>
            <span className="line"><span className="line-in">feedback.</span></span>
            <span className="line"><span className="line-in"><span className="hl">Ship designs faster.</span></span></span>
          </h1>
          <p className="sub rise d2">
            Pin comments <strong>directly on designs</strong>. Clients leave precise
            feedback, you know exactly what to fix — <strong>without a single email thread</strong>.
          </p>
          <div className="hero-cta rise d3">
            <a className="btn lg magnet burst" href="https://vynl.in/sign-up">
              Start Your 7-Day Free Trial <span className="arr">→</span>
            </a>
            <span className="micro">
              <em>✓</em> No credit card&nbsp;&nbsp;<em>✓</em> Clients need no account
            </span>
          </div>

          {/* interactive demo — the product itself */}
          <div className="demo rise d4">
            <div className="frame">
              <div className="frame-bar">
                <span className="dot r" /><span className="dot y" /><span className="dot g" />
                <span className="url">⌘ &nbsp;client-website.com/home</span>
                <span className="ver">v3 · 2 open</span>
              </div>
              <div className="stage">
                <div className="stage-hint"><span className="blink" /> Try it — click anywhere to drop a pin</div>
                <div className="art" aria-hidden="true">
                  <div className="a-nav"><span className="a-logo" /><span className="a-links"><i /><i /><i /></span></div>
                  <span className="a-h" /><span className="a-h2" />
                  <span className="a-p w1" /><span className="a-p w2" /><span className="a-p w3" />
                  <span className="a-cta" />
                  <div className="a-imgs"><span className="a-img" /><span className="a-img" /><span className="a-img" /></div>
                </div>
                <div className="pin p-red demo-pin dp1" style={{ left: "26%", top: "33%" }}>
                  <span className="inner"><span className="head"><i>1</i></span></span>
                  <span className="bubble"><b>SARAH · CLIENT</b>Can this headline be two lines instead of three?</span>
                </div>
                <div className="pin p-blue demo-pin dp2 flip" style={{ left: "63%", top: "56%" }}>
                  <span className="inner"><span className="head"><i>2</i></span></span>
                  <span className="bubble"><b>DEV · TEAMMATE</b>Button contrast fails AA — bump it up a notch.</span>
                </div>
                <div className="pin p-green demo-pin dp3 flip" style={{ left: "81%", top: "82%" }}>
                  <span className="inner"><span className="head"><i>✓</i></span></span>
                  <span className="bubble"><b>SARAH · CLIENT</b>Third image swapped — approved! 🎉</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="mq-clip" aria-hidden="true">
        <div className="marquee">
          <div className="marquee-in">
            {[...Array(2)].map((_, k) => (
              <span key={k} className="mq-run">
                {["Freelance Designers","Design Studios","Marketing Teams","UI/UX Designers","Creative Agencies","Web Developers"].map((t) => (
                  <span key={t} className="item">{t}</span>
                ))}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ================= FEATURES — editorial rows, no cards ================= */}
      <section className="sec" id="features">
        <div className="wrap">
          <div className="sec-head io">
            <span className="eyebrow" style={{ "--dot": "var(--blue)" }}>Features</span>
            <h2>Everything you need for <span className="hl">precise</span> design feedback</h2>
          </div>

          <div className="rows">
            <article className="row io" data-fx="annotate" style={{ "--mk": "var(--red)" }}>
              <span className="row-line" aria-hidden="true" />
              <span className="fx-marquee" aria-hidden="true">
                <i className="fx-handle tl" /><i className="fx-handle tr" />
                <i className="fx-handle bl" /><i className="fx-handle br" />
              </span>
              <span className="row-pin" aria-hidden="true"><i>1</i></span>
              <div className="row-body">
                <h3>Visual Annotation</h3>
                <p>Draw boxes, highlight areas, and pin comments directly on images or website screenshots. Everyone sees exactly what you mean — <strong>no screenshots inside screenshots</strong>.</p>
              </div>
              <span className="row-ghost" aria-hidden="true">01</span>
            </article>

            <article className="row io" data-fx="revise" style={{ "--mk": "var(--blue)" }}>
              <span className="row-line" aria-hidden="true" />
              <span className="fx-vtag" aria-hidden="true"><i>v1</i><i>v2</i><i>v3</i></span>
              <span className="row-pin" aria-hidden="true"><i>2</i></span>
              <div className="row-body">
                <h3 data-text="Built-in Revisions">Built-in Revisions</h3>
                <p>Upload new versions without losing old feedback. Every version keeps its annotations, so you can track what changed, when, and why — <strong>no file naming chaos</strong>.</p>
              </div>
              <span className="row-ghost" aria-hidden="true">02</span>
            </article>

            <article className="row io" data-fx="collab" style={{ "--mk": "var(--green)" }}>
              <span className="row-line" aria-hidden="true" />
              <span className="row-pin" aria-hidden="true"><i>3</i></span>
              <div className="row-body">
                <h3>Real-time Collaboration</h3>
                <p>Invite clients or teammates via a link. Reviewers need no account — <strong>they just click and comment</strong>. Updates and approvals show up instantly for everyone.</p>
              </div>
              <span className="row-ghost" aria-hidden="true">03</span>
            </article>

            <article className="row io" data-fx="comment" style={{ "--mk": "var(--yellow)" }}>
              <span className="row-line" aria-hidden="true" />
              <span className="row-pin dark" aria-hidden="true"><i>4</i></span>
              <div className="row-body">
                <h3>Contextual Comments</h3>
                <p>Every comment stays attached to the exact element it refers to. No more guessing <strong>&quot;which button?&quot;</strong> or <strong>&quot;which section?&quot;</strong> — feedback is always tied to the visual.</p>
              </div>
              <span className="row-ghost" aria-hidden="true">04</span>
            </article>
          </div>
        </div>
      </section>

      {/* ================= CHAOS → CLARITY, strikes on scroll ================= */}
      <section className="sec tight">
        <div className="wrap">
          <div className="sec-head io">
            <span className="eyebrow" style={{ "--dot": "var(--red)" }}>Sound familiar?</span>
            <h2>No chaos. No confusion.<br />Just <span className="hl">clarity</span>.</h2>
          </div>

          <div className="chaos">
            <p className="chaos-label io">You&apos;ve lived this chaos 🎨</p>
            <ul className="pain">
              <li className="io"><span className="pain-t">That one hero section that needs <strong>27 Slack messages</strong> to align.</span></li>
              <li className="io"><span className="pain-t"><strong>Slack threads longer</strong> than your Figma file.</span></li>
              <li className="io"><span className="pain-t"><strong>Toddler-doodle-level</strong> markup on screenshots.</span></li>
              <li className="io"><span className="pain-t"><strong>&quot;Make it pop more&quot;</strong> as the official direction.</span></li>
              <li className="io"><span className="pain-t"><strong>final_v9_final-reallyfinal.png</strong> haunting your drive.</span></li>
            </ul>

            <p className="chaos-label good io">It doesn&apos;t have to be that hard 👇</p>
            <ul className="fix">
              <li className="io"><em>✓</em><span><strong>Upload</strong> your design or <strong>drop a website link</strong>.</span></li>
              <li className="io"><em>✓</em><span>Comments appear <strong>exactly where they should</strong> — never decode vague messages again.</span></li>
              <li className="io"><em>✓</em><span>Every change and approval gets <strong>tracked automatically</strong> — no chaos, no hunting.</span></li>
              <li className="io"><em>✓</em><span>Clients stay focused and specific, leading to <strong>faster approvals</strong> and <strong>fewer revision loops</strong>.</span></li>
            </ul>
          </div>
        </div>
      </section>

      {/* ================= HOW IT WORKS — sticky rail ================= */}
      <section className="sec tight">
        <div className="wrap hiw">
          <div className="hiw-left">
            <div className="sticky io">
              <span className="eyebrow" style={{ "--dot": "var(--green)" }}>How it works</span>
              <h2>From upload to approval in <span className="hl">minutes</span></h2>
              <p className="hiw-note">Scroll — the loop closes itself.</p>
            </div>
          </div>
          <div className="hiw-right">
            <span className="rail" aria-hidden="true"><span className="rail-fill" /></span>
            <div className="step"><span className="s-num">01</span><h3>Upload</h3><p>Upload images or paste a website link</p></div>
            <div className="step"><span className="s-num">02</span><h3>Annotate</h3><p>Pin comments directly on the design</p></div>
            <div className="step"><span className="s-num">03</span><h3>Track</h3><p>Monitor each comment&apos;s status</p></div>
            <div className="step"><span className="s-num">04</span><h3>Revise</h3><p>Upload new versions after resolving feedback</p></div>
            <div className="step last">
              <span className="s-num">05</span><h3>Sign off</h3><p>Get client approval and close the loop</p>
              <span className="stamp" aria-hidden="true">APPROVED ✓</span>
            </div>
          </div>
        </div>
      </section>

      {/* ================= STATS — big type, rules only ================= */}
      <section className="sec tight">
        <div className="wrap">
          <div className="stats">
            <div className="stat io">
              <span className="big"><em data-count="2">0</em>×</span>
              <h4>Faster client approvals</h4>
              <p>&quot;VYNL helped us cut review time in half.&quot; — Shivani D., Freelance Designer</p>
            </div>
            <div className="stat io">
              <span className="big"><em data-count="50">0</em>%</span>
              <h4>Less back-and-forth</h4>
              <p>Teams report vs. email-based feedback workflows</p>
            </div>
            <div className="stat io">
              <span className="big">0</span>
              <h4>Tools for clients to install</h4>
              <p>Reviewers just click a link — no signup, no app, no friction</p>
            </div>
          </div>
        </div>
      </section>

      {/* ================= QUOTES — editorial, no boxes ================= */}
      <section className="sec tight">
        <div className="wrap">
          <div className="sec-head io">
            <span className="eyebrow" style={{ "--dot": "var(--yellow)" }}>What users say</span>
            <h2>Real results from <span className="hl">real teams</span></h2>
          </div>
          <figure className="quote io">
            <blockquote>&quot;VYNL helped us cut review time in half. Clients actually enjoy giving feedback now.&quot;</blockquote>
            <figcaption><span className="av y">SD</span><span><b>Shivani Dubey</b><small>Showit Website Designer · Freelancer</small></span></figcaption>
          </figure>
          <figure className="quote alt io">
            <blockquote>&quot;The annotation tools are intuitive and the collaboration features make client communication seamless. Game changer for our design workflow.&quot;</blockquote>
            <figcaption><span className="av b">RR</span><span><b>Ritvik Reddy</b><small>Marketing Manager · Marketing Dojo</small></span></figcaption>
          </figure>
        </div>
      </section>

      {/* ================= COMPARE ================= */}
      <section className="sec tight">
        <div className="wrap">
          <div className="sec-head io">
            <span className="eyebrow" style={{ "--dot": "var(--blue)" }}>Why VYNL</span>
            <h2>Better than your <span className="hl">current workflow</span></h2>
            <p>Using email, Slack, or Figma comments for client feedback? Here&apos;s what you&apos;re missing.</p>
          </div>
          <div className="tbl io">
            <table>
              <thead><tr><th style={{ textAlign: "left" }}>Feature</th><th>Email / Slack</th><th>Figma Comments</th><th className="vy">VYNL</th></tr></thead>
              <tbody>
                <tr><th>Contextual, pinned feedback</th><td className="n">✗</td><td className="y">✓</td><td className="y vy">✓</td></tr>
                <tr><th>Colored markers to group similar feedback</th><td className="n">✗</td><td className="n">✗</td><td className="y vy">✓</td></tr>
                <tr><th>Box markers to highlight feedback areas</th><td className="n">✗</td><td className="n">✗</td><td className="y vy">✓</td></tr>
                <tr><th>Works on any website / URL</th><td className="n">✗</td><td className="n">✗</td><td className="y vy">✓</td></tr>
                <tr><th>Comment status tracking</th><td className="n">✗</td><td className="n">✗</td><td className="y vy">✓</td></tr>
                <tr><th>Version history &amp; revisions</th><td className="n">✗</td><td className="p">PARTIAL</td><td className="y vy">✓</td></tr>
                <tr><th>Built for non-designer clients</th><td className="y">✓</td><td className="n">✗</td><td className="y vy">✓</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ================= PRICING — divided columns, no cards ================= */}
      <section className="sec tight" id="pricing">
        <div className="wrap">
          <div className="sec-head io">
            <span className="eyebrow" style={{ "--dot": "var(--green)" }}>Pricing</span>
            <h2>Simple, <span className="hl">honest</span> pricing</h2>
            <p>7 days free — no credit card needed to get started. Then choose your plan.</p>
          </div>
          <div className="plans io">
            <div className="plan">
              <h3>Free</h3>
              <p className="desc">7-day free trial with basic features</p>
              <p className="price">$0<small>/month after trial</small></p>
              <ul>
                <li>1 workspace</li><li>1 project per workspace</li>
                <li>3 files per project</li><li>1GB storage</li>
              </ul>
              <a className="btn ghost" href="https://vynl.in/sign-up">Start 7-Day Free Trial</a>
            </div>
            <div className="plan pro">
              <span className="tag">★ MOST POPULAR</span>
              <h3>Pro</h3>
              <p className="desc">Advanced features for growing teams and agencies</p>
              <p className="price">$10<small>/month</small></p>
              <p className="save">✓ Save 16.66% with yearly billing</p>
              <ul>
                <li>Unlimited workspaces</li><li>Unlimited projects per workspace</li>
                <li>1000 files per project</li><li>50GB storage</li><li>100MB file size limit</li>
              </ul>
              <a className="btn magnet" href="https://vynl.in/pricing">Upgrade to Pro <span className="arr">→</span></a>
            </div>
          </div>
        </div>
      </section>

      {/* ================= BETA — full-bleed yellow ================= */}
      <section className="beta">
        <div className="wrap">
          <div className="io">
            <span className="eyebrow ink" style={{ "--dot": "var(--bg)" }}>Beta Program</span>
            <h2>Help us build something better</h2>
            <p className="b-sub">We&apos;re inviting a small group of designers to use VYNL before the full launch — and directly shape what gets built next.</p>
            <a className="btn dark magnet burst" href="https://vynl.in/beta">Apply for Beta Access <span className="arr">→</span></a>
            <p className="spots">Limited to 10 spots · Application required</p>
          </div>
          <div className="beta-grid">
            <div className="io"><span className="bn">01</span><h4>Free Pro access</h4><p>Use VYNL at no cost for the full duration of the beta period.</p></div>
            <div className="io"><span className="bn">02</span><h4>Direct founder line</h4><p>Report bugs and suggest features straight to the people building it.</p></div>
            <div className="io"><span className="bn">03</span><h4>Shape the roadmap</h4><p>Your feedback decides what gets prioritised and shipped next.</p></div>
          </div>
        </div>
      </section>

      {/* ================= FAQ ================= */}
      <section className="sec">
        <div className="wrap">
          <div className="sec-head io">
            <span className="eyebrow" style={{ "--dot": "var(--red)" }}>FAQ</span>
            <h2>Common <span className="hl">questions</span></h2>
          </div>
          <div className="faq io">
            {[
              ["How is VYNL different from Figma comments?", <>Figma comments live inside Figma — which your clients don&apos;t use. VYNL works on <strong>any image or live website URL</strong>, adds <strong>colored and box markers</strong> to group feedback, tracks every comment&apos;s status, and keeps full version history. Your clients just click a link.</>],
              ["Can I annotate live websites, not just images?", <>Yes. Paste any URL and reviewers can <strong>pin comments directly on the live page</strong> — no screenshots needed. Feedback stays attached to the exact element it refers to.</>],
              ["Does VYNL work on mobile?", <>Yes — reviewers can open the share link and leave pinned comments from <strong>any modern browser</strong>, on desktop, tablet, or phone. No app to install.</>],
              ["How does version tracking work?", <>Upload a new version after resolving feedback and VYNL keeps every previous version <strong>with its annotations intact</strong>. You can see exactly what changed, when, and why.</>],
              ["Is my data secure?", <>Your files are <strong>encrypted in transit and at rest</strong>, and share links are private by default — only people with the link can view a project.</>],
              ["Can I cancel anytime?", <>Yes. Cancel in one click from your account settings, <strong>no lock-in and no hidden fees</strong>. Your trial doesn&apos;t even ask for a credit card.</>],
              ["Will my clients need to create an account to leave feedback?", <>No — and that&apos;s the point. Clients open your link and <strong>click to comment instantly</strong>. No signup, no app, no friction.</>],
            ].map(([q, a], i) => (
              <div className="qa" key={i}>
                <button aria-expanded="false" type="button">{q}<span className="plus">+</span></button>
                <div className="ans"><p>{a}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= FINAL CTA ================= */}
      <section className="final">
        <div className="wrap io">
          <h2>Ready to make feedback <span className="hl">actually work</span>?</h2>
          <p>Join hundreds of designers who&apos;ve replaced email chaos with VYNL.</p>
          <a className="btn lg magnet burst" href="https://vynl.in/sign-up">Start Your 7-Day Free Trial <span className="arr">→</span></a>
          <p className="psst">psst — click the logo pin, top left.</p>
        </div>
      </section>

      <footer>
        <div className="foot">
          <span className="logo sm">VYNL</span>
          <span>© 2025 · Designed for Creators</span>
          <span className="f-links">
            <a href="https://vynl.in/legal/privacy">Privacy Policy</a>
            <a href="https://vynl.in/legal/terms">Terms</a>
            <a href="https://vynl.in/contact">Support</a>
          </span>
        </div>
      </footer>

      <style jsx global>{`
        :root {
          color-scheme: dark;
          --bg: #0c0d0b;
          --bg2: #12140f;
          --ink: #f4f4ec;
          --soft: #b3b6aa;
          --line: rgba(244, 244, 236, 0.14);
          --line2: rgba(244, 244, 236, 0.3);
          --yellow: #ffe14d;
          --red: #ff5a36;
          --blue: #7c97ff;
          --green: #3bda82;
          --on-yellow: #0c0d0b;
          --accent-text: var(--yellow);
          --stat-accent: var(--yellow);
          --nav-bg: rgba(12, 13, 11, 0.75);
          --dot-grid: rgba(244, 244, 236, 0.1);
          --art-bg: #1a1c17;
          --art-strong: var(--ink);
          --art-muted: rgba(244, 244, 236, 0.22);
          --art-img-a: #232620;
          --art-img-b: #2e322a;
          --bubble-muted: rgba(12, 13, 11, 0.55);
          --vy-bg: rgba(255, 225, 77, 0.08);
          --vy-head: var(--yellow);
          --frame-shadow: 0 40px 90px -40px rgba(0, 0, 0, 0.8);
          --display: "Cabinet Grotesk", sans-serif;
          --body: "Switzer", sans-serif;
          --mono: "JetBrains Mono", monospace;
        }
        @media (prefers-color-scheme: light) {
          :root {
            color-scheme: light;
            --bg: #f2f3ef;
            --bg2: #fbfbf9;
            --ink: #141513;
            --soft: #4a4d45;
            --line: rgba(20, 21, 19, 0.16);
            --line2: rgba(20, 21, 19, 0.34);
            --yellow: #ffde38;
            --red: #d93815;
            --blue: #2447e0;
            --green: #0b7a3c;
            --accent-text: var(--blue);
            --stat-accent: var(--blue);
            --nav-bg: rgba(242, 243, 239, 0.82);
            --dot-grid: rgba(20, 21, 19, 0.16);
            --art-bg: #ffffff;
            --art-strong: #141513;
            --art-muted: #dcded6;
            --art-img-a: #edeee9;
            --art-img-b: #dcded6;
            --bubble-muted: rgba(242, 243, 239, 0.6);
            --vy-bg: rgba(255, 222, 56, 0.3);
            --vy-head: #141513;
            --frame-shadow: 0 32px 70px -32px rgba(20, 21, 19, 0.32);
          }
          /* white numerals on saturated pins; ink on yellow */
          .p-red .head i, .p-blue .head i, .p-green .head i { color: #fff; }
          .row-pin i { color: #fff; }
          .row-pin.dark i { color: var(--on-yellow); }
          /* dark film grain instead of white */
          .vynl::before { filter: invert(1); opacity: 0.4; }
          .rail-fill, .step.live::before { box-shadow: none; }
          .eyebrow::before { box-shadow: none; }
          .btn:hover { box-shadow: 0 10px 26px -10px rgba(20, 21, 19, 0.4); }
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        body {
          font-family: var(--body);
          background: var(--bg);
          color: var(--ink);
          font-size: 17px;
          line-height: 1.6;
          -webkit-font-smoothing: antialiased;
          overflow-x: hidden;
        }
        ::selection { background: var(--yellow); color: var(--on-yellow); }
        a { color: inherit; text-decoration: none; }
        button { font-family: inherit; cursor: pointer; border: none; background: none; color: inherit; }
        .wrap { max-width: 1160px; margin: 0 auto; padding: 0 28px; }
        :focus-visible { outline: 2.5px solid var(--blue); outline-offset: 3px; border-radius: 4px; }

        /* film grain */
        .vynl::before {
          content: "";
          position: fixed; inset: 0; z-index: 300; pointer-events: none; opacity: 0.5;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.03 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
        }

        /* scroll progress */
        .progress {
          position: fixed; top: 0; left: 0; right: 0; height: 3px; z-index: 400;
          background: var(--yellow); transform-origin: left; transform: scaleX(0);
        }

        h1, h2, h3 { font-family: var(--display); line-height: 1.02; letter-spacing: -0.02em; }
        .eyebrow {
          font-family: var(--mono); font-size: 12px; font-weight: 500;
          text-transform: uppercase; letter-spacing: 0.14em; color: var(--soft);
          display: inline-flex; align-items: center; gap: 9px;
        }
        .eyebrow::before {
          content: ""; width: 9px; height: 9px; border-radius: 50%;
          background: var(--dot, var(--blue));
          box-shadow: 0 0 14px 1px var(--dot, var(--blue));
        }
        .eyebrow.ink { color: rgba(12, 13, 11, 0.75); }
        .eyebrow.ink::before { box-shadow: none; }

        /* highlighter: yellow swipe + ink text for contrast */
        .hl {
          position: relative; white-space: nowrap; z-index: 0; color: var(--on-yellow);
          padding: 0 0.08em;
        }
        .hl::after {
          content: ""; position: absolute; z-index: -1;
          left: -0.04em; right: -0.08em; top: 0.08em; bottom: 0.02em;
          background: var(--yellow);
          transform: skewX(-8deg) scaleX(1); transform-origin: left center;
          border-radius: 3px;
          transition: transform 0.8s cubic-bezier(0.7, 0, 0.2, 1);
        }
        .pre .hero .hl::after { transform: skewX(-8deg) scaleX(0); }
        .pre .hero .hl { color: var(--ink); transition: color 0.1s 0.7s; }
        .loaded .hero .hl { color: var(--on-yellow); transition: color 0.1s 0.55s; }
        .loaded .hero .hl::after { transition-delay: 0.45s; }

        .strike { position: relative; }
        .strike svg { position: absolute; left: -2%; top: 52%; width: 104%; height: 0.5em; overflow: visible; pointer-events: none; }
        .strike path { stroke: var(--red); stroke-width: 5; fill: none; stroke-linecap: round; stroke-dasharray: 600; stroke-dashoffset: 0; transition: stroke-dashoffset 0.7s ease 0.9s; }
        .pre .hero .strike path { stroke-dashoffset: 600; }

        /* ---------- nav ---------- */
        nav {
          position: sticky; top: 0; z-index: 200;
          background: var(--nav-bg);
          backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
          border-bottom: 1px solid var(--line);
        }
        .nav-in { max-width: 1160px; margin: 0 auto; padding: 0 28px; height: 66px; display: flex; align-items: center; justify-content: space-between; }
        .logo { font-family: var(--display); font-weight: 800; font-size: 22px; display: flex; align-items: center; gap: 9px; }
        .logo-pin {
          height: 26px; width: auto; display: block; cursor: pointer;
          transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .logo-pin:hover { transform: scale(1.12) rotate(-6deg); }
        .logo-pin:active { transform: scale(1.05) rotate(8deg); }
        .nav-links { display: flex; gap: 30px; font-size: 15px; font-weight: 500; color: var(--soft); }
        .nav-links a { position: relative; padding: 4px 0; transition: color 0.2s; }
        .nav-links a:hover { color: var(--ink); }
        .nav-links a::after { content: ""; position: absolute; left: 0; bottom: 0; height: 2px; width: 100%; background: var(--yellow); transform: scaleX(0); transform-origin: left; transition: transform 0.25s cubic-bezier(0.7, 0, 0.2, 1); }
        .nav-links a:hover::after { transform: scaleX(1); }
        .nav-cta { display: flex; align-items: center; gap: 18px; }
        .signin { font-size: 15px; font-weight: 500; color: var(--soft); }
        .signin:hover { color: var(--ink); }

        .btn {
          display: inline-flex; align-items: center; gap: 10px;
          font-weight: 600; font-size: 16px;
          background: var(--ink); color: var(--bg) !important;
          padding: 14px 26px; border-radius: 100px;
          transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.25s, background 0.25s;
        }
        .btn:hover { background: var(--yellow); color: var(--on-yellow) !important; box-shadow: 0 0 34px -6px rgba(255, 225, 77, 0.55); }
        .btn .arr { transition: transform 0.2s; }
        .btn:hover .arr { transform: translateX(4px); }
        .btn.sm { padding: 10px 20px; font-size: 14.5px; }
        .btn.lg { padding: 18px 34px; font-size: 17.5px; }
        .btn.ghost { background: transparent; color: var(--ink) !important; box-shadow: inset 0 0 0 1.5px var(--line2); }
        .btn.ghost:hover { box-shadow: inset 0 0 0 1.5px var(--accent-text); background: transparent; color: var(--accent-text) !important; }
        .btn.dark { background: #0c0d0b; color: #ffe14d !important; }
        .btn.dark:hover { box-shadow: 0 10px 30px -8px rgba(12, 13, 11, 0.6); background: #0c0d0b; color: #ffe14d !important; }

        /* ---------- hero ---------- */
        .hero { padding: 96px 0 46px; position: relative; overflow: visible; }
        .hero h1 { font-size: clamp(52px, 8.4vw, 112px); font-weight: 800; }
        .hero h1 .line { display: block; overflow: hidden; padding-bottom: 0.06em; margin-bottom: -0.06em; }
        .hero h1 .line-in { display: inline-block; transform: translateY(110%); transition: transform 0.9s cubic-bezier(0.2, 0.7, 0.2, 1); }
        .hero h1 .line:nth-child(2) .line-in { transition-delay: 0.08s; }
        .hero h1 .line:nth-child(3) .line-in { transition-delay: 0.16s; }
        .loaded .hero h1 .line-in { transform: none; }
        .sub { margin-top: 28px; font-size: clamp(17px, 1.6vw, 21px); color: var(--soft); max-width: 52ch; line-height: 1.55; }
        .sub strong { color: var(--ink); font-weight: 600; }
        .hero-cta { margin-top: 38px; display: flex; align-items: center; gap: 24px; flex-wrap: wrap; }
        .micro { font-family: var(--mono); font-size: 12.5px; color: var(--soft); display: flex; align-items: center; gap: 7px; }
        .micro em { color: var(--green); font-style: normal; font-weight: 600; }
        .rise { opacity: 0; transform: translateY(26px); transition: opacity 0.9s cubic-bezier(0.2, 0.7, 0.2, 1), transform 0.9s cubic-bezier(0.2, 0.7, 0.2, 1); }
        .loaded .rise { opacity: 1; transform: none; }
        .loaded .d2 { transition-delay: 0.24s; }
        .loaded .d3 { transition-delay: 0.36s; }
        .loaded .d4 { transition-delay: 0.5s; }

        /* floating parallax pins */
        .float { position: absolute; z-index: 1; width: 30px; height: 30px; border-radius: 50% 50% 50% 6px; opacity: 0.9; pointer-events: none; }
        .f1 { top: 130px; right: 12%; background: var(--red); rotate: -45deg; }
        .f2 { top: 320px; right: 5%; background: var(--blue); rotate: -45deg; width: 22px; height: 22px; }
        .f3 { top: 480px; right: 18%; background: var(--green); rotate: -45deg; width: 18px; height: 18px; opacity: 0.7; }

        /* ---------- demo frame ---------- */
        .demo { margin-top: 74px; }
        .frame { background: var(--bg2); border: 1px solid var(--line2); border-radius: 18px; box-shadow: var(--frame-shadow); }
        .frame-bar { display: flex; align-items: center; gap: 10px; padding: 13px 18px; border-bottom: 1px solid var(--line); }
        .frame-bar .dot { width: 11px; height: 11px; border-radius: 50%; }
        .dot.r { background: var(--red); } .dot.y { background: var(--yellow); } .dot.g { background: var(--green); }
        .frame-bar .url { margin-left: 10px; flex: 1; max-width: 340px; font-family: var(--mono); font-size: 12px; color: var(--soft); background: var(--bg); border: 1px solid var(--line); padding: 5px 13px; border-radius: 100px; }
        .frame-bar .ver { margin-left: auto; font-family: var(--mono); font-size: 11.5px; font-weight: 600; background: var(--yellow); color: var(--on-yellow); padding: 4px 11px; border-radius: 100px; }
        .stage {
          position: relative; padding: clamp(24px, 4vw, 52px); cursor: crosshair;
          border-radius: 0 0 18px 18px;
          background-image: radial-gradient(var(--dot-grid) 1.15px, transparent 1.15px);
          background-size: 22px 22px;
        }
        .stage-hint {
          position: absolute; top: 14px; right: 18px; z-index: 5;
          font-family: var(--mono); font-size: 11.5px; color: var(--ink);
          display: flex; align-items: center; gap: 7px;
          background: var(--bg); border: 1px solid var(--line2);
          padding: 6px 12px; border-radius: 100px;
          animation: hint 2.6s ease-in-out infinite;
        }
        @keyframes hint { 0%, 100% { transform: none; } 50% { transform: translateY(-3px); } }
        .blink { width: 8px; height: 8px; border-radius: 50%; background: var(--red); animation: blink 1.4s infinite; }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.25; } }

        .art { background: var(--art-bg); border: 1px solid var(--line); border-radius: 12px; padding: clamp(22px, 3.4vw, 44px); max-width: 740px; margin: 0 auto; }
        .a-nav { display: flex; justify-content: space-between; align-items: center; margin-bottom: 34px; }
        .a-logo { display: block; width: 74px; height: 14px; border-radius: 4px; background: var(--art-strong); }
        .a-links { display: flex; gap: 10px; }
        .a-links i { display: block; width: 38px; height: 9px; border-radius: 3px; background: var(--art-muted); }
        .a-h, .a-h2 { display: block; height: 26px; border-radius: 6px; background: var(--art-strong); margin-bottom: 12px; }
        .a-h { width: 78%; } .a-h2 { width: 52%; margin-bottom: 22px; }
        .a-p { display: block; height: 10px; border-radius: 3px; background: var(--art-muted); margin-bottom: 9px; }
        .w1 { width: 92%; } .w2 { width: 84%; } .w3 { width: 60%; }
        .a-cta { display: block; margin-top: 24px; width: 132px; height: 36px; border-radius: 100px; background: var(--blue); }
        .a-imgs { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-top: 34px; }
        .a-img { aspect-ratio: 4/3; border-radius: 8px; background: linear-gradient(135deg, var(--art-img-a), var(--art-img-b)); position: relative; overflow: hidden; }
        .a-img::after { content: ""; position: absolute; inset: 0; background: linear-gradient(105deg, transparent 40%, var(--dot-grid) 50%, transparent 60%); transform: translateX(-100%); animation: sheen 5s ease-in-out infinite; }
        @keyframes sheen { 0%, 60% { transform: translateX(-100%); } 90%, 100% { transform: translateX(100%); } }

        /* ---------- pins ---------- */
        .pin { position: absolute; z-index: 20; width: 32px; height: 32px; transform: translate(-50%, -100%); }
        .pin .inner { display: block; opacity: 0; transform: translateY(-30px) scale(0.4); transform-origin: bottom center; }
        .pin .inner.landed, .loaded .demo-pin .inner { animation: pindrop 0.55s cubic-bezier(0.34, 1.7, 0.5, 1) forwards; }
        .loaded .dp1 .inner { animation-delay: 1.3s; }
        .loaded .dp2 .inner { animation-delay: 1.55s; }
        .loaded .dp3 .inner { animation-delay: 1.8s; }
        @keyframes pindrop {
          0% { opacity: 0; transform: translateY(-30px) scale(0.4); }
          70% { opacity: 1; transform: translateY(3px) scale(1.04); }
          100% { opacity: 1; transform: none; }
        }
        .pin .head {
          width: 32px; height: 32px; border-radius: 50% 50% 50% 5px; transform: rotate(-45deg);
          display: grid; place-items: center;
          box-shadow: 0 6px 18px -4px rgba(0, 0, 0, 0.7);
          transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .pin .head i { transform: rotate(45deg); font-style: normal; font-family: var(--mono); font-size: 12px; font-weight: 600; color: var(--on-yellow); }
        .pin:hover .head { transform: rotate(-45deg) scale(1.18); }
        .p-red .head { background: var(--red); }
        .p-blue .head { background: var(--blue); }
        .p-green .head { background: var(--green); }
        .p-yellow .head { background: var(--yellow); }
        .pin .bubble {
          position: absolute; bottom: 42px; left: -8px; min-width: 210px; max-width: 250px;
          background: var(--ink); color: var(--bg);
          border-radius: 12px 12px 12px 3px; padding: 11px 14px;
          font-size: 13.5px; line-height: 1.45;
          opacity: 0; transform: translateY(8px) scale(0.94); transform-origin: bottom left;
          transition: opacity 0.2s, transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
          pointer-events: none; z-index: 30;
        }
        .pin .bubble b { font-family: var(--mono); font-size: 10.5px; letter-spacing: 0.05em; color: var(--bubble-muted); display: block; margin-bottom: 4px; font-weight: 600; }
        .pin:hover .bubble, .pin.show .bubble { opacity: 1; transform: none; }
        .pin.flip .bubble { left: auto; right: -8px; border-radius: 12px 12px 3px 12px; transform-origin: bottom right; }

        .confetti-pin { position: fixed; z-index: 500; width: 14px; height: 14px; border-radius: 50% 50% 50% 3px; pointer-events: none; }

        /* ---------- marquee ---------- */
        .mq-clip { overflow: hidden; }
        .marquee { border-top: 1px solid var(--line2); border-bottom: 1px solid var(--line2); background: var(--yellow); padding: 15px 0; transform: rotate(-1.1deg) scale(1.02); overflow: hidden; }
        .marquee-in { display: flex; width: max-content; animation: mq 30s linear infinite; }
        .marquee:hover .marquee-in { animation-play-state: paused; }
        @keyframes mq { to { transform: translateX(-50%); } }
        .mq-run { display: flex; }
        .item { font-family: var(--display); font-weight: 700; font-size: 17px; color: var(--on-yellow); display: flex; align-items: center; gap: 22px; padding-right: 22px; white-space: nowrap; }
        .item::after { content: "✳"; font-size: 14px; }

        /* ---------- sections / reveals ---------- */
        .sec { padding: 130px 0; }
        .sec.tight { padding-top: 0; }
        .sec-head { max-width: 780px; margin-bottom: 70px; }
        .sec-head h2 { font-size: clamp(36px, 4.8vw, 62px); font-weight: 800; margin-top: 18px; }
        .sec-head p { margin-top: 16px; color: var(--soft); font-size: 18px; max-width: 56ch; }
        .io { opacity: 0; transform: translateY(38px); transition: opacity 0.85s cubic-bezier(0.2, 0.7, 0.2, 1), transform 0.85s cubic-bezier(0.2, 0.7, 0.2, 1); }
        .io.in { opacity: 1; transform: none; }

        /* ---------- feature rows (no cards) ---------- */
        .rows { display: flex; flex-direction: column; }
        .row { position: relative; display: grid; grid-template-columns: 64px 1fr auto; gap: 30px; align-items: start; padding: 52px 0 56px; }
        .row-line { position: absolute; top: 0; left: 0; right: 0; height: 2px; background: var(--mk); transform: scaleX(0); transform-origin: left; transition: transform 1s cubic-bezier(0.7, 0, 0.2, 1) 0.1s; }
        .row.in .row-line { transform: scaleX(1); }
        .row-pin { width: 40px; height: 40px; border-radius: 50% 50% 50% 6px; background: var(--mk); transform: rotate(-45deg) translateY(-14px) scale(0.5); opacity: 0; display: grid; place-items: center; transition: transform 0.6s cubic-bezier(0.34, 1.7, 0.5, 1) 0.35s, opacity 0.3s 0.35s; margin-top: 6px; }
        .row.in .row-pin { transform: rotate(-45deg); opacity: 1; }
        .row-pin i { transform: rotate(45deg); font-style: normal; font-family: var(--mono); font-weight: 600; font-size: 13.5px; color: var(--on-yellow); }
        .row-body h3 { font-size: clamp(28px, 3.2vw, 42px); font-weight: 800; margin-bottom: 14px; }
        .row-body p { color: var(--soft); font-size: 17.5px; max-width: 62ch; }
        .row-body strong { color: var(--ink); font-weight: 600; }
        .row-ghost {
          font-family: var(--display); font-weight: 800; font-size: clamp(70px, 9vw, 150px);
          line-height: 0.8; color: transparent;
          -webkit-text-stroke: 1.5px var(--line2);
          user-select: none;
          opacity: 0; transform: translateX(40px);
          transition: opacity 0.9s 0.25s, transform 0.9s cubic-bezier(0.2, 0.7, 0.2, 1) 0.25s;
        }
        .row.in .row-ghost { opacity: 1; transform: none; }

        /* ---------- feature-row signature hovers ---------- */
        .row { transition: background 0.45s ease; }
        .row::before {
          content: ""; position: absolute; left: -24px; right: -24px; top: 1px; bottom: 0;
          background: radial-gradient(130% 120% at 0% 50%, color-mix(in srgb, var(--mk) 15%, transparent), transparent 62%);
          opacity: 0; transition: opacity 0.5s ease; pointer-events: none; z-index: 0; border-radius: 12px;
        }
        .row:hover::before { opacity: 1; }
        .row-pin, .row-ghost, .row-body { position: relative; z-index: 1; }

        /* fx — Visual Annotation: crosshair + marching-ants selection box */
        .row[data-fx="annotate"] { cursor: crosshair; }
        .fx-marquee {
          position: absolute; inset: 4px 2px 8px 52px; z-index: 1; border-radius: 4px;
          opacity: 0; pointer-events: none; transition: opacity 0.25s ease;
          background-image:
            linear-gradient(90deg, var(--red) 50%, transparent 0),
            linear-gradient(90deg, var(--red) 50%, transparent 0),
            linear-gradient(0deg, var(--red) 50%, transparent 0),
            linear-gradient(0deg, var(--red) 50%, transparent 0);
          background-size: 12px 2px, 12px 2px, 2px 12px, 2px 12px;
          background-position: 0 0, 0 100%, 0 0, 100% 0;
          background-repeat: repeat-x, repeat-x, repeat-y, repeat-y;
        }
        .row[data-fx="annotate"]:hover .fx-marquee { opacity: 1; animation: ants 0.55s linear infinite; }
        @keyframes ants { to { background-position: 12px 0, -12px 100%, 0 -12px, 100% 12px; } }
        .fx-handle {
          position: absolute; width: 9px; height: 9px; background: var(--red);
          border: 2px solid var(--bg); border-radius: 2px;
          opacity: 0; transform: scale(0);
          transition: transform 0.28s cubic-bezier(0.34, 1.7, 0.5, 1), opacity 0.2s;
        }
        .fx-handle.tl { left: -5px; top: -5px; }
        .fx-handle.tr { right: -5px; top: -5px; }
        .fx-handle.bl { left: -5px; bottom: -5px; }
        .fx-handle.br { right: -5px; bottom: -5px; }
        .row[data-fx="annotate"]:hover .fx-handle { opacity: 1; transform: scale(1); }

        /* fx — Built-in Revisions: onion-skin version ghosts + scrub cursor */
        .row[data-fx="revise"]:hover { cursor: ew-resize; }
        .row[data-fx="revise"] .row-body h3 { position: relative; z-index: 1; }
        .row[data-fx="revise"] .row-body h3::before,
        .row[data-fx="revise"] .row-body h3::after {
          content: attr(data-text); position: absolute; left: 0; top: 0; white-space: nowrap;
          color: transparent; -webkit-text-stroke: 1.2px var(--blue); z-index: -1;
          opacity: 0; pointer-events: none;
          transition: transform 0.45s cubic-bezier(0.2, 0.7, 0.2, 1), opacity 0.45s ease;
        }
        .row[data-fx="revise"]:hover .row-body h3::before { opacity: 0.55; transform: translate(13px, -13px); }
        .row[data-fx="revise"]:hover .row-body h3::after { opacity: 0.28; transform: translate(26px, -26px); }
        .fx-vtag {
          position: absolute; right: 0; top: 8px; display: flex; gap: 6px; z-index: 2;
          opacity: 0; transform: translateY(-6px);
          transition: opacity 0.4s ease, transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .fx-vtag i {
          font-style: normal; font-family: var(--mono); font-size: 11px; font-weight: 600;
          color: var(--blue); border: 1px solid var(--blue); border-radius: 100px; padding: 3px 9px;
        }
        .fx-vtag i:last-child { background: var(--blue); color: var(--bg); }
        .row[data-fx="revise"]:hover .fx-vtag { opacity: 1; transform: none; }

        /* fx — Real-time Collaboration: live multiplayer cursors (JS-spawned) */
        .fx-cursor {
          position: absolute; left: 0; top: 0; z-index: 4; pointer-events: none;
          display: flex; align-items: flex-start; gap: 3px; opacity: 0;
          transition: opacity 0.3s ease; will-change: transform;
        }
        .fx-cursor.on { opacity: 1; }
        .fx-cursor svg { width: 20px; height: 20px; filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.45)); }
        .fx-cursor b {
          font-family: var(--mono); font-size: 10.5px; font-weight: 600; color: #fff;
          padding: 2px 7px; border-radius: 2px 9px 9px 9px; white-space: nowrap;
        }

        /* fx — Contextual Comments: comment pin trails the cursor (JS-spawned) */
        .row[data-fx="comment"]:hover { cursor: none; }
        .fx-follow {
          position: absolute; left: 0; top: 0; z-index: 5; pointer-events: none;
          opacity: 0; transition: opacity 0.18s ease; will-change: transform;
        }
        .fx-follow.on { opacity: 1; }
        .fx-follow-head {
          position: absolute; left: 0; top: 0; width: 26px; height: 26px;
          background: var(--yellow); border-radius: 50% 50% 50% 4px; transform: rotate(-45deg);
          box-shadow: 0 6px 16px -4px rgba(0, 0, 0, 0.6); display: block;
        }
        .fx-follow-head::after {
          content: ""; position: absolute; inset: 0; margin: auto; width: 7px; height: 7px;
          border-radius: 50%; background: var(--on-yellow);
        }
        .fx-follow-bubble {
          position: absolute; left: 22px; top: -4px; white-space: nowrap;
          background: var(--ink); color: var(--bg); font-family: var(--mono); font-size: 11px; font-weight: 600;
          padding: 6px 11px; border-radius: 10px 10px 10px 2px;
        }

        /* ---------- chaos → clarity ---------- */
        .chaos { max-width: 780px; }
        .chaos-label { font-family: var(--display); font-weight: 800; font-size: clamp(22px, 2.4vw, 28px); margin-bottom: 20px; }
        .chaos-label.good { margin-top: 64px; color: var(--green); }
        .pain, .fix { list-style: none; }
        .pain li { padding: 16px 0; border-bottom: 1px dashed var(--line); font-size: clamp(17px, 1.9vw, 21px); color: var(--soft); }
        .pain strong { color: var(--ink); font-weight: 600; }
        .pain-t { position: relative; display: inline; background-image: linear-gradient(var(--red), var(--red)); background-repeat: no-repeat; background-position: 0 58%; background-size: 0% 3px; transition: background-size 0.7s cubic-bezier(0.7, 0, 0.2, 1) 0.3s; }
        .pain li.in .pain-t { background-size: 100% 3px; }
        .fix li { display: flex; gap: 14px; padding: 16px 0; border-bottom: 1px dashed var(--line); font-size: clamp(17px, 1.9vw, 21px); color: var(--soft); align-items: baseline; }
        .fix li em { font-style: normal; color: var(--bg); background: var(--green); width: 24px; height: 24px; flex: none; border-radius: 50% 50% 50% 5px; rotate: -45deg; display: grid; place-items: center; font-size: 12px; font-weight: 700; transform: scale(0); transition: transform 0.5s cubic-bezier(0.34, 1.7, 0.5, 1) 0.3s; }
        .fix li em { transform-origin: center; }
        .fix li.in em { transform: scale(1) rotate(45deg); }
        .fix strong { color: var(--ink); font-weight: 600; }

        /* ---------- how it works: sticky rail ---------- */
        .hiw { display: grid; grid-template-columns: 1fr 1.1fr; gap: 70px; align-items: start; }
        .hiw-left .sticky { position: sticky; top: 120px; }
        .hiw-left h2 { font-size: clamp(34px, 4.4vw, 56px); font-weight: 800; margin-top: 18px; }
        .hiw-note { margin-top: 18px; font-family: var(--mono); font-size: 13px; color: var(--soft); }
        .hiw-right { position: relative; padding-left: 44px; }
        .rail { position: absolute; left: 8px; top: 60px; width: 2px; height: 0; background: var(--line); }
        .rail-fill { position: absolute; top: 0; left: 0; width: 100%; height: 0; background: var(--yellow); transition: height 0.18s linear; box-shadow: 0 0 12px rgba(255, 225, 77, 0.6); }
        .step { padding: 44px 0; border-bottom: 1px solid var(--line); position: relative; opacity: 0.32; transform: translateX(20px); transition: opacity 0.6s, transform 0.6s cubic-bezier(0.2, 0.7, 0.2, 1); }
        .step.live { opacity: 1; transform: none; }
        .step::before { content: ""; position: absolute; left: -43px; top: 52px; width: 16px; height: 16px; border-radius: 50% 50% 50% 3px; rotate: -45deg; background: var(--line2); transition: background 0.4s, box-shadow 0.4s; }
        .step.live::before { background: var(--yellow); box-shadow: 0 0 14px rgba(255, 225, 77, 0.7); }
        .s-num { font-family: var(--mono); font-size: 12.5px; color: var(--soft); font-weight: 600; }
        .step h3 { font-size: clamp(26px, 2.8vw, 36px); font-weight: 800; margin: 10px 0 8px; }
        .step p { color: var(--soft); font-size: 16.5px; }
        .step.last { border-bottom: none; }
        .stamp {
          position: absolute; right: 0; top: 34px;
          font-family: var(--display); font-weight: 800; font-size: clamp(18px, 2vw, 26px);
          color: var(--green); border: 3px solid var(--green); border-radius: 10px;
          padding: 6px 16px; letter-spacing: 0.04em;
          transform: rotate(8deg) scale(3); opacity: 0; pointer-events: none;
        }
        .stamp.slam { animation: slam 0.5s cubic-bezier(0.2, 0.9, 0.3, 1.4) 0.25s forwards; }
        @keyframes slam {
          0% { transform: rotate(14deg) scale(3); opacity: 0; }
          60% { transform: rotate(-7deg) scale(0.94); opacity: 1; }
          100% { transform: rotate(-7deg) scale(1); opacity: 1; }
        }

        /* ---------- stats: rules, no boxes ---------- */
        .stats { display: grid; grid-template-columns: repeat(3, 1fr); border-top: 1px solid var(--line2); }
        .stat { padding: 46px 34px 10px 0; border-left: 1px solid var(--line); padding-left: 34px; }
        .stat:first-child { border-left: none; padding-left: 0; }
        .big { font-family: var(--display); font-weight: 800; font-size: clamp(64px, 7vw, 104px); line-height: 1; letter-spacing: -0.03em; display: block; }
        .big em { font-style: normal; color: var(--stat-accent); }
        .stat h4 { font-size: 18px; font-weight: 700; margin-top: 12px; font-family: var(--display); }
        .stat p { margin-top: 8px; font-size: 14.5px; color: var(--soft); }

        /* ---------- quotes: editorial ---------- */
        .quote { border-top: 1px solid var(--line2); padding: 56px 0 8px; margin: 0; }
        .quote blockquote { font-family: var(--display); font-weight: 700; font-size: clamp(26px, 3.6vw, 46px); line-height: 1.2; letter-spacing: -0.015em; max-width: 22ch; }
        .quote.alt blockquote { margin-left: auto; text-align: right; }
        .quote figcaption { margin-top: 26px; display: flex; align-items: center; gap: 14px; }
        .quote.alt figcaption { justify-content: flex-end; }
        .av { width: 46px; height: 46px; border-radius: 50%; display: grid; place-items: center; font-family: var(--display); font-weight: 800; font-size: 16px; color: var(--bg); }
        .av.y { background: var(--yellow); }
        .av.b { background: var(--blue); }
        .quote b { display: block; font-size: 15.5px; font-weight: 600; }
        .quote small { font-family: var(--mono); font-size: 11.5px; color: var(--soft); }

        /* ---------- table ---------- */
        .tbl { border-top: 1px solid var(--line2); overflow-x: auto; }
        table { width: 100%; border-collapse: collapse; font-size: 15.5px; min-width: 640px; }
        th, td { padding: 17px 22px; text-align: center; border-bottom: 1px solid var(--line); }
        thead th { font-family: var(--mono); font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; font-weight: 600; color: var(--soft); }
        tbody th { text-align: left; font-weight: 500; color: var(--ink); }
        td.y { color: var(--green); font-weight: 700; }
        td.n { color: var(--red); opacity: 0.85; }
        td.p { color: var(--soft); font-family: var(--mono); font-size: 12px; }
        .vy { background: var(--vy-bg); box-shadow: inset 2px 0 0 var(--yellow), inset -2px 0 0 var(--yellow); }
        thead th.vy { color: var(--vy-head); font-weight: 700; }

        /* ---------- pricing: divided, no cards ---------- */
        .plans { display: grid; grid-template-columns: 1fr 1fr; max-width: 900px; border-top: 1px solid var(--line2); }
        .plan { padding: 48px 48px 8px 0; }
        .plan.pro { border-left: 1px solid var(--line); padding-left: 48px; padding-right: 0; position: relative; }
        .plan .tag { display: inline-block; background: var(--yellow); color: var(--on-yellow); font-family: var(--mono); font-size: 11.5px; font-weight: 600; letter-spacing: 0.06em; padding: 5px 14px; border-radius: 100px; transform: rotate(-2deg); margin-bottom: 18px; }
        .plan h3 { font-size: 30px; font-weight: 800; }
        .plan .desc { color: var(--soft); font-size: 15px; margin-top: 6px; }
        .plan .price { margin: 26px 0 6px; font-family: var(--display); font-weight: 800; font-size: 58px; letter-spacing: -0.03em; line-height: 1; }
        .plan .price small { font-family: var(--body); font-size: 16px; font-weight: 500; color: var(--soft); letter-spacing: 0; }
        .plan .save { font-family: var(--mono); font-size: 12px; color: var(--green); font-weight: 600; }
        .plan ul { list-style: none; margin: 26px 0 30px; display: grid; gap: 12px; }
        .plan li { display: flex; gap: 11px; font-size: 15.5px; align-items: baseline; color: var(--ink); }
        .plan li::before { content: "✓"; color: var(--green); font-weight: 700; font-size: 14px; }

        /* ---------- beta: full-bleed yellow ---------- */
        .beta { background: #ffde38; color: #0c0d0b; padding: clamp(70px, 8vw, 120px) 0; }
        .beta h2 { font-size: clamp(36px, 4.8vw, 62px); font-weight: 800; margin-top: 18px; max-width: 15ch; }
        .b-sub { margin-top: 18px; color: rgba(12, 13, 11, 0.78); max-width: 52ch; font-size: 18px; }
        .beta .btn { margin-top: 34px; }
        .spots { margin-top: 16px; font-family: var(--mono); font-size: 12.5px; color: rgba(12, 13, 11, 0.65); }
        .beta-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 40px; margin-top: 64px; }
        .beta-grid > div { border-top: 2px solid rgba(12, 13, 11, 0.9); padding-top: 20px; }
        .bn { font-family: var(--mono); font-size: 12.5px; font-weight: 600; }
        .beta-grid h4 { font-family: var(--display); font-size: 20px; font-weight: 800; margin: 10px 0 8px; }
        .beta-grid p { font-size: 14.5px; color: rgba(12, 13, 11, 0.75); }

        /* ---------- FAQ ---------- */
        .faq { max-width: 820px; }
        .qa { border-bottom: 1px solid var(--line2); }
        .qa:first-child { border-top: 1px solid var(--line2); }
        .qa > button { width: 100%; display: flex; justify-content: space-between; align-items: center; gap: 20px; padding: 26px 6px; text-align: left; font-family: var(--display); font-weight: 700; font-size: clamp(18px, 2vw, 23px); letter-spacing: -0.01em; transition: padding-left 0.25s, color 0.2s; }
        .qa > button:hover { padding-left: 14px; color: var(--accent-text); }
        .plus { flex: none; width: 34px; height: 34px; border-radius: 50%; border: 1.5px solid var(--line2); display: grid; place-items: center; transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.25s, color 0.25s; font-family: var(--body); font-weight: 500; font-size: 19px; color: var(--ink); }
        .qa.open .plus { transform: rotate(45deg); background: var(--yellow); color: var(--on-yellow); border-color: var(--yellow); }
        .ans { max-height: 0; overflow: hidden; transition: max-height 0.45s cubic-bezier(0.2, 0.7, 0.2, 1); }
        .ans p { padding: 0 6px 28px; color: var(--soft); max-width: 62ch; font-size: 16.5px; }
        .ans strong { color: var(--ink); font-weight: 600; }

        /* ---------- final ---------- */
        .final { padding: 150px 0 130px; text-align: center; }
        .final h2 { font-size: clamp(44px, 6.6vw, 88px); font-weight: 800; max-width: 16ch; margin: 0 auto; }
        .final p { margin: 24px auto 0; color: var(--soft); font-size: 19px; max-width: 44ch; }
        .final .btn { margin-top: 42px; }
        .psst { margin-top: 34px; font-family: var(--mono); font-size: 12px; color: var(--soft); opacity: 0.7; }

        footer { border-top: 1px solid var(--line2); padding: 34px 0; }
        .foot { max-width: 1160px; margin: 0 auto; padding: 0 28px; display: flex; justify-content: space-between; align-items: center; gap: 20px; flex-wrap: wrap; font-size: 14px; color: var(--soft); }
        .f-links { display: flex; gap: 24px; }
        .f-links a:hover { color: var(--ink); }
        .logo.sm { font-size: 18px; color: var(--ink); }

        /* ---------- responsive ---------- */
        @media (max-width: 960px) {
          .nav-links { display: none; }
          .row { grid-template-columns: 52px 1fr; }
          .row-ghost { display: none; }
          .hiw { grid-template-columns: 1fr; gap: 30px; }
          .hiw-left .sticky { position: static; }
          .stats { grid-template-columns: 1fr; border-top: none; }
          .stat { border-left: none; padding-left: 0; border-top: 1px solid var(--line2); padding-top: 34px; }
          .plans { grid-template-columns: 1fr; }
          .plan.pro { border-left: none; border-top: 1px solid var(--line); padding-left: 0; margin-top: 24px; padding-top: 44px; }
          .beta-grid { grid-template-columns: 1fr; gap: 26px; }
          .float { display: none; }
          .quote.alt blockquote { margin-left: 0; text-align: left; }
          .quote.alt figcaption { justify-content: flex-start; }
        }
        @media (max-width: 600px) {
          .sec { padding: 84px 0; }
          .sec.tight { padding-top: 0; }
          .hero { padding: 60px 0 30px; }
          .hero-cta .btn { width: 100%; justify-content: center; }
          .hl { white-space: normal; -webkit-box-decoration-break: clone; box-decoration-break: clone; }
          .stage-hint { position: static; margin: 0 0 14px; width: max-content; max-width: 100%; }
        }
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after { animation-duration: 0.001s !important; transition-duration: 0.001s !important; animation-delay: 0s !important; transition-delay: 0s !important; }
          html { scroll-behavior: auto; }
          .io, .rise, .hero h1 .line-in, .row-ghost, .row-pin, .step { opacity: 1; transform: none; }
          .pin .inner, .demo-pin .inner { opacity: 1; transform: none; animation: none; }
          .row-line { transform: scaleX(1); }
          .pain-t { background-size: 100% 3px; }
          .fix li em { transform: scale(1) rotate(45deg); }
        }
      `}</style>

    </main>
  );
}
