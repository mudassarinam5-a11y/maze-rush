            information or create an account to play.
          </p>
        </div>

        <div className="rounded-2xl border border-indigo-300/25 bg-[#0c1024]/90 p-5">
          <h3 className="font-display text-lg font-bold text-white">
            7. CHANGES TO THIS POLICY
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            We may update this Privacy Policy when the game or its
            services change. Any updates will be published on this page.
          </p>
        </div>

        <div className="rounded-2xl border border-indigo-300/25 bg-[#0c1024]/90 p-5">
          <h3 className="font-display text-lg font-bold text-white">
            8. CONTACT
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            Developer: Mudassir Inam
          </p>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            For privacy-related questions, please use the contact
            information provided on the Maze Rush Contact Us page.
          </p>
        </div>

        <p className="text-center text-xs text-slate-500">
          Thank you for playing Maze Rush!
        </p>

      </div>
    </Shell>
  );
}

// ------------------------------------------------------------------ TERMS & CONDITIONS
export function TermsScreen({ onBack }: { onBack: () => void }) {
  const sections = [
    {
      title: "1. ACCEPTANCE OF TERMS",
      body: "By accessing or playing Maze Rush, you agree to these Terms & Conditions. If you do not agree with these terms, please do not use the game."
    },
    {
      title: "2. ABOUT THE GAME",
      body: "Maze Rush is a browser-based puzzle game provided for entertainment. The game includes 80 levels across four difficulty modes: Easy, Normal, Hard, and Impossible."
    },
    {
      title: "3. GAME RULES AND FAIR USE",
      body: "You agree to use the game fairly and not to intentionally interfere with its operation, attempt to disrupt the website, or misuse any part of the game."
    },
    {
      title: "4. INTELLECTUAL PROPERTY",
      body: "Unless otherwise stated, the Maze Rush name, game design, text, graphics, and original game materials are owned by or used by the developer. You may play the game for personal, non-commercial entertainment. You must not copy, republish, sell, or redistribute the game or its materials without permission."
    },
    {
      title: "5. USER RESPONSIBILITIES",
      body: "You are responsible for using a compatible and reasonably secure browser and device. Your game progress may be stored in your browser. Clearing browser site data or changing devices or browsers may remove saved progress."
    },
    {
      title: "6. AVAILABILITY AND UPDATES",
      body: "We may update, improve, suspend, or change parts of Maze Rush when needed. We aim to keep the game available, but uninterrupted access cannot be guaranteed."
    },
    {
      title: "7. LIMITATION OF LIABILITY",
      body: "Maze Rush is provided on an as-available basis for entertainment. To the extent permitted by applicable law, the developer is not responsible for losses arising from temporary unavailability, lost browser-stored progress, or issues caused by a user's device, browser, or internet connection."
    },
    {
      title: "8. CHANGES TO THESE TERMS",
      body: "These Terms & Conditions may be updated as the game or website changes. Any revised version will be published on this page. Continued use of the game after an update means you accept the revised terms."
    },
    {
      title: "9. CONTACT INFORMATION",
      body: "For questions about these Terms & Conditions, please use the contact information that will be provided on the Maze Rush Help Center page."
    }
  ];

  return (
    <Shell>
      <BackButton onClick={onBack} />
      <ScreenTitle sub="Please read the rules for using Maze Rush.">TERMS & CONDITIONS</ScreenTitle>

      <div className="anim-slide-up mt-4 flex w-full max-w-xl flex-col gap-3 pb-4">
        <p className="text-xs text-slate-500">
          Last updated: November 7, 2026
        </p>

        {sections.map((section, index) => (
          <div
            key={section.title}
            className={`rounded-2xl border ${index === 0 ? "border-cyan-300/30" : "border-indigo-300/25"} bg-[#0c1024]/90 p-5`}
          >
            <h3 className={`font-display text-lg font-bold ${index === 0 ? "text-cyan-300" : "text-white"}`}>
              {section.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              {section.body}
            </p>
          </div>
        ))}

        <p className="text-center text-xs text-slate-500">
          Thank you for playing Maze Rush!
        </p>
      </div>
    </Shell>
  );
}

