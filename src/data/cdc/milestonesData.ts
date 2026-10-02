// CDC developmental milestones for all 12 ages; Japanese wording reviewed against CDC age pages on 2026-09-30

export interface MilestoneItem {
  en: string;
  ja: string;
}

// [Social, Language, Cognitive, Movement] counts follow the CDC age pages.
// Each age's milestone list below is ordered in these groups.
export const milestoneCategoryCounts: Record<string, readonly [number, number, number, number]> = {
  "2 mo": [4, 2, 2, 3],
  "4 mo": [3, 3, 2, 5],
  "6 mo": [3, 3, 3, 3],
  "9 mo": [5, 2, 2, 4],
  "1 year": [1, 3, 2, 4],
  "15 mo": [5, 4, 2, 2],
  "18 mo": [5, 2, 2, 6],
  "2 years": [2, 4, 3, 4],
  "30 mo": [3, 4, 4, 4],
  "3 years": [2, 5, 2, 3],
  "4 years": [6, 4, 3, 4],
  "5 years": [3, 4, 6, 2],
};

export const detailedMilestonesData: Record<string, MilestoneItem[]> = {
  "2 mo": [
    {
      "en": "Calms down when spoken to or picked up",
      "ja": "話しかけられたり抱き上げられると落ち着く"
    },
    {
      "en": "Looks at your face",
      "ja": "あなたの顔を見つめる"
    },
    {
      "en": "Seems happy to see you when you walk up to him",
      "ja": "あなたが近づくと嬉しそうにする"
    },
    {
      "en": "Smiles when you talk to or smile at him",
      "ja": "話しかけたり笑いかけたりすると笑う"
    },
    {
      "en": "Makes sounds other than crying",
      "ja": "泣き声以外の声を出す"
    },
    {
      "en": "Reacts to loud sounds",
      "ja": "大きな音に反応する"
    },
    {
      "en": "Watches you as you move",
      "ja": "あなたが動くのを目で追う"
    },
    {
      "en": "Looks at a toy for several seconds",
      "ja": "おもちゃを数秒間じっと見つめる"
    },
    {
      "en": "Holds head up when on tummy",
      "ja": "うつ伏せにしたとき頭を持ち上げる"
    },
    {
      "en": "Moves both arms and both legs",
      "ja": "両腕と両足を動かす"
    },
    {
      "en": "Opens hands briefly",
      "ja": "手を一時的にパッと開く"
    }
  ],
  "4 mo": [
    {
      "en": "Smiles on his own to get your attention",
      "ja": "あなたの注意を引くために自分から微笑む"
    },
    {
      "en": "Chuckles (not yet a full laugh) when you try to make him laugh",
      "ja": "笑わせようとすると、声を出して軽く笑う（まだ大笑いではない）"
    },
    {
      "en": "Looks at you, moves, or makes sounds to get or keep your attention",
      "ja": "注意を引くために見つめたり、動いたり、声を出したりする"
    },
    {
      "en": "Makes cooing sounds like \"oooo\", \"aahh\" (cooing)",
      "ja": "「あー」「うー」などのクーイング音を出す"
    },
    {
      "en": "Makes sounds back when you talk to him",
      "ja": "話しかけると声を出して応える"
    },
    {
      "en": "Turns head towards the sound of your voice",
      "ja": "あなたの声のする方に顔を向ける"
    },
    {
      "en": "If hungry, opens mouth when he sees breast or bottle",
      "ja": "お腹が空いているとき、乳房や哺乳瓶を見ると口を開ける"
    },
    {
      "en": "Looks at his hands with interest",
      "ja": "自分の手を興味深そうに見つめる"
    },
    {
      "en": "Holds head steady without support when you are holding him",
      "ja": "抱っこしているとき、支えがなくても頭をしっかり保つ（首すわり）"
    },
    {
      "en": "Holds a toy when you put it in his hand",
      "ja": "手に持たせてあげるとおもちゃを握っている"
    },
    {
      "en": "Uses his arm to swing at toys",
      "ja": "腕を振っておもちゃに触ろうとする"
    },
    {
      "en": "Brings hands to mouth",
      "ja": "手を口元に持っていく"
    },
    {
      "en": "Pushes up onto elbows/forearms when on tummy",
      "ja": "うつ伏せのとき、肘や前腕で体を押し上げる"
    }
  ],
  "6 mo": [
    {
      "en": "Knows familiar people",
      "ja": "身近なよく知っている人がわかる"
    },
    {
      "en": "Likes to look at himself in a mirror",
      "ja": "鏡の中の自分を見るのが好き"
    },
    {
      "en": "Laughs",
      "ja": "声を出して笑う"
    },
    {
      "en": "Takes turns making sounds with you",
      "ja": "あなたと交互に声を出してやり取りする"
    },
    {
      "en": "Blows \"raspberries\" (sticks tongue out and blows)",
      "ja": "舌を出して「ぶー」と音を鳴らす（ラズベリー音）"
    },
    {
      "en": "Makes squealing noises",
      "ja": "甲高い声を出す"
    },
    {
      "en": "Puts things in his mouth to explore them",
      "ja": "物を確かめるように口に入れる"
    },
    {
      "en": "Reaches to grab a toy he wants",
      "ja": "欲しいおもちゃをつかもうと手を伸ばす"
    },
    {
      "en": "Closes lips to show he doesn't want more food",
      "ja": "もういらないときに唇を閉じる"
    },
    {
      "en": "Rolls from tummy to back",
      "ja": "うつ伏せから仰向けに寝返りする"
    },
    {
      "en": "Pushes up with straight arms when on tummy",
      "ja": "うつ伏せのとき、腕をまっすぐ伸ばして上半身を持ち上げる"
    },
    {
      "en": "Leans on hands to support himself when sitting",
      "ja": "お座りのとき、手をついて体を支える"
    }
  ],
  "9 mo": [
    {
      "en": "Is shy, clingy, or fearful around strangers",
      "ja": "見知らぬ人に対して人見知りをしたり怖がったりする"
    },
    {
      "en": "Shows several facial expressions, like happy, sad, angry, and surprised",
      "ja": "嬉しい、悲しい、怒った、驚いたなど多様な表情を見せる"
    },
    {
      "en": "Looks when you call his name",
      "ja": "名前を呼ぶと振り向いて見る"
    },
    {
      "en": "Reacts when you leave (looks, reaches for you, or cries)",
      "ja": "あなたが離れると反応する（目で追う、手を伸ばす、泣く）"
    },
    {
      "en": "Smiles or laughs when you play peek-a-boo",
      "ja": "いないいないばあをすると笑う"
    },
    {
      "en": "Makes a lot of different sounds like \"mamamama\" and \"babababa\"",
      "ja": "「ママママ」「ババババ」など、いろいろな声をたくさん出す"
    },
    {
      "en": "Lifts arms up to be picked up",
      "ja": "抱っこを求めて両腕を持ち上げる"
    },
    {
      "en": "Looks for objects when dropped out of sight (like his spoon or toy)",
      "ja": "スプーンやおもちゃなど、落として見えなくなった物を探す"
    },
    {
      "en": "Bangs two things together",
      "ja": "2つの物をカチカチ打ち合わせる"
    },
    {
      "en": "Gets to a sitting position by himself",
      "ja": "自分で座る姿勢になる"
    },
    {
      "en": "Moves things from one hand to his other hand",
      "ja": "物を片方の手からもう片方の手へ持ち替える"
    },
    {
      "en": "Uses fingers to rake food towards himself",
      "ja": "指を使って食べ物を自分の方にかき寄せる"
    },
    {
      "en": "Sits without support",
      "ja": "支えなしで一人で座れる"
    }
  ],
  "1 year": [
    {
      "en": "Plays games with you, like pat-a-cake",
      "ja": "あなたと一緒に、手遊びなどの簡単なやり取り遊びをする"
    },
    {
      "en": "Waves \"bye-bye\"",
      "ja": "「バイバイ」と手を振る"
    },
    {
      "en": "Calls a parent \"mama\" or \"dada\" or another special name",
      "ja": "親を「ママ」「パパ」などの特別な呼び名で呼ぶ"
    },
    {
      "en": "Understands \"no\" (pauses briefly or stops when you say it)",
      "ja": "「だめ」と言われると、一瞬動きを止めるか、していることをやめる"
    },
    {
      "en": "Puts something in a container, like a block in a cup",
      "ja": "カップに積木を入れるなど、物を容器に入れる"
    },
    {
      "en": "Looks for things he sees you hide, like a toy under a blanket",
      "ja": "毛布の下に隠したおもちゃなど、隠すのを見た物を探す"
    },
    {
      "en": "Pulls up to stand",
      "ja": "つかまり立ちをする"
    },
    {
      "en": "Walks, holding on to furniture",
      "ja": "家具につかまって伝い歩きをする"
    },
    {
      "en": "Drinks from a cup without a lid, as you hold it",
      "ja": "大人が支えてあげるとフタなしコップから飲む"
    },
    {
      "en": "Picks things up between thumb and pointer finger, like small bits of food",
      "ja": "小さな食べ物を親指と人差し指でつまんで取る（指先つまみ）"
    }
  ],
  "15 mo": [
    {
      "en": "Copies other children while playing, like taking toys out of a container when another child does",
      "ja": "遊んでいるときに、ほかの子のまねをする（例：ほかの子が容器からおもちゃを出すと、自分も出す）"
    },
    {
      "en": "Shows you an object he likes",
      "ja": "自分が気に入った物をあなたに見せてくれる"
    },
    {
      "en": "Claps when excited",
      "ja": "嬉しいときや興奮したときに手を叩く（拍手する）"
    },
    {
      "en": "Hugs stuffed doll or other toy",
      "ja": "ぬいぐるみやほかのおもちゃを抱きしめる"
    },
    {
      "en": "Shows you affection (hugs, cuddles, or kisses you)",
      "ja": "抱きついたり、寄り添ったり、キスしたりして愛情を示す"
    },
    {
      "en": "Tries to say one or two words besides \"mama\" or \"dada,\" like \"ba\" for ball or \"da\" for dog",
      "ja": "「ママ」「パパ」以外の言葉を1〜2語、言おうとする（言葉の一部でもよい）"
    },
    {
      "en": "Looks at a familiar object when you name it",
      "ja": "物の名前を言うと、そのよく知っている物を見る"
    },
    {
      "en": "Follows directions given with both a gesture and words. For example, he gives you a toy when you hold out your hand and say, \"Give me the toy.\"",
      "ja": "手を差し出して「おもちゃをちょうだい」と言うと、おもちゃを渡すなど、身振りと言葉の両方で伝えられた指示に従う"
    },
    {
      "en": "Points to ask for something or to get help",
      "ja": "何かを欲しいときや助けてほしいときに、指さして伝える"
    },
    {
      "en": "Tries to use things the right way, like a phone, cup, or book",
      "ja": "電話、コップ、絵本などを正しい使い方で使おうとする"
    },
    {
      "en": "Stacks at least two small objects, like blocks",
      "ja": "積木など小さな物を少なくとも2つ積み上げる"
    },
    {
      "en": "Takes a few steps on his own",
      "ja": "一人で数歩歩く"
    },
    {
      "en": "Uses fingers to feed himself some food",
      "ja": "手づかみで自分で食べ物を口に運ぶ"
    }
  ],
  "18 mo": [
    {
      "en": "Moves away from you, but looks to make sure you are close by",
      "ja": "あなたから離れても、近くにいるか振り返って確かめる"
    },
    {
      "en": "Points to show you something interesting",
      "ja": "面白いものを見つけると、あなたに見せようと指差す"
    },
    {
      "en": "Puts hands out for you to wash them",
      "ja": "手を洗ってもらうために両手を差し出す"
    },
    {
      "en": "Looks at a few pages in a book with you",
      "ja": "あなたと一緒に絵本のページを数ページ眺める"
    },
    {
      "en": "Helps you dress him by pushing arm through sleeve or lifting up foot",
      "ja": "着替えのとき、袖に腕を通したり足を上げたりして協力する"
    },
    {
      "en": "Tries to say three or more words besides \"mama\" or \"dada\"",
      "ja": "「ママ」「パパ」以外に3語以上の言葉を話そうとする"
    },
    {
      "en": "Follows one-step directions without any gestures, like giving you the toy when you say, \"Give it to me.\"",
      "ja": "「それをちょうだい」と言うとおもちゃを渡すなど、身振りなしの1段階の指示に従う"
    },
    {
      "en": "Copies you doing chores, like sweeping with a broom",
      "ja": "ほうきで掃くなど、大人の家事の真似をする"
    },
    {
      "en": "Plays with toys in a simple way, like pushing a toy car",
      "ja": "ミニカーを押すなど、おもちゃを使って簡単な遊びをする"
    },
    {
      "en": "Walks without holding on to anyone or anything",
      "ja": "何にもつかまらずに一人で歩く"
    },
    {
      "en": "Scribbles",
      "ja": "なぐり書きをする"
    },
    {
      "en": "Drinks from a cup without a lid and may spill sometimes",
      "ja": "フタなしコップから飲む（たまにこぼすこともある）"
    },
    {
      "en": "Feeds himself with his fingers",
      "ja": "指を使って自分で食べる"
    },
    {
      "en": "Tries to use a spoon",
      "ja": "スプーンを使おうとする"
    },
    {
      "en": "Climbs on and off a couch or chair without help",
      "ja": "大人の手助けなしでソファや椅子を上り下りする"
    }
  ],
  "2 years": [
    {
      "en": "Notices when others are hurt or upset, like pausing or looking sad when someone is crying",
      "ja": "誰かが泣いていると立ち止まったり悲しそうな顔をしたりするなど、他の人が傷ついたり動揺したりしていることに気づく"
    },
    {
      "en": "Looks at your face to see how to react in a new situation",
      "ja": "初めての場面で、どう反応するかを確かめるようにあなたの顔を見る"
    },
    {
      "en": "Points to things in a book when you ask, like \"Where is the bear?\"",
      "ja": "「くまさんはどこ？」と聞くと、絵本の中のものを指差す"
    },
    {
      "en": "Says at least two words together, like \"More milk.\"",
      "ja": "「まんま ちょうだい」など、少なくとも2語を続けて話す"
    },
    {
      "en": "Points to at least two body parts when you ask him to show you",
      "ja": "尋ねられると、体の部分を少なくとも2つ指さす"
    },
    {
      "en": "Uses more gestures than just waving and pointing, like blowing a kiss or nodding yes",
      "ja": "バイバイや指差しだけでなく、投げキッスや「うん」とうなずくなど、さまざまな身振りを使う"
    },
    {
      "en": "Holds something in one hand while using the other hand; for example, holding a container and taking the lid off",
      "ja": "容器を片手で押さえてもう片方の手でふたを取るなど、片方の手で物を持ちながらもう片方の手を使う"
    },
    {
      "en": "Tries to use switches, knobs, or buttons on a toy",
      "ja": "おもちゃのスイッチやボタン、つまみを操作しようとする"
    },
    {
      "en": "Plays with more than one toy at the same time, like putting toy food on a toy plate",
      "ja": "おもちゃの皿に食べ物を乗せるなど、2つ以上のおもちゃを組み合わせて遊ぶ"
    },
    {
      "en": "Kicks a ball",
      "ja": "ボールを蹴る"
    },
    {
      "en": "Runs",
      "ja": "走る"
    },
    {
      "en": "Walks (not climbs) up a few stairs with or without help",
      "ja": "手助けの有無にかかわらず、数段の階段をよじ登らずに歩いて上がる"
    },
    {
      "en": "Eats with a spoon",
      "ja": "スプーンを使って食べる"
    }
  ],
  "30 mo": [
    {
      "en": "Plays next to other children and sometimes plays with them",
      "ja": "ほかの子どもの隣で遊び、ときには一緒に遊ぶ"
    },
    {
      "en": "Shows you what he can do by saying \"Look at me!\"",
      "ja": "「見て！」と言って自分ができることを見せる"
    },
    {
      "en": "Follows simple routines when told, like helping to pick up toys when you say \"It's clean-up time.\"",
      "ja": "「お片付けの時間だよ」と言われたときにおもちゃを片付けるなど、簡単な日課に従う"
    },
    {
      "en": "Says about 50 words",
      "ja": "約50語の言葉を話す"
    },
    {
      "en": "Says two or more words together, with one action word, like \"Doggie run\"",
      "ja": "「ワンワン 走った」のように、動作を表す言葉を含む2語以上を続けて話す"
    },
    {
      "en": "Names things in a book when you point and ask, \"What is this?\"",
      "ja": "絵本を指差して「これなぁに？」と尋ねると物の名前を言う"
    },
    {
      "en": "Says words like \"I,\" \"me,\" or \"we\"",
      "ja": "「ぼく」「わたし」「わたしたち」などの言葉を使う"
    },
    {
      "en": "Uses things to pretend, like feeding a block to a doll as if it were food",
      "ja": "積木を食べ物に見立てて人形に食べさせるなど、見立て遊び・ごっこ遊びをする"
    },
    {
      "en": "Shows simple problem-solving skills, like standing on a small stool to reach something",
      "ja": "物を取るために小さな踏み台の上に立つなど、簡単な問題解決をする"
    },
    {
      "en": "Follows two-step instructions like \"Put the toy down and close the door\"",
      "ja": "「おもちゃを置いてドアを閉めて」のような2段階の指示に従う"
    },
    {
      "en": "Shows he knows at least one color, like pointing to a red crayon when you ask, \"Which one is red?\"",
      "ja": "「赤はどれ？」と聞かれて赤いクレヨンを指すなど、少なくとも1つの色を知っている"
    },
    {
      "en": "Uses hands to twist things, like turning doorknobs or unscrewing lids",
      "ja": "ドアノブを回したり、ねじ式のふたを回して開けたりする"
    },
    {
      "en": "Takes some clothes off by himself, like loose pants or an open jacket",
      "ja": "ゆったりしたズボンや前の開いた上着など、衣服を自分で脱ぐ"
    },
    {
      "en": "Jumps off the ground with both feet",
      "ja": "両足をそろえて地面からピョンとジャンプする"
    },
    {
      "en": "Turns book pages, one at a time, when you read to him",
      "ja": "本を読んでもらうとき、1ページずつめくる"
    }
  ],
  "3 years": [
    {
      "en": "Calms down within 10 minutes after you leave him, like at a childcare drop off",
      "ja": "保育園などに預けるとき、あなたと離れてから10分以内に落ち着く"
    },
    {
      "en": "Notices other children and joins them to play",
      "ja": "他の子どもに気づいて、自分から遊びの輪に加わる"
    },
    {
      "en": "Talks with you in conversation using at least two back-and-forth exchanges",
      "ja": "2往復以上のやり取りがある会話をする"
    },
    {
      "en": "Asks \"who\", \"what\", \"where\", or \"why\" questions, like \"Where is mommy/daddy?\"",
      "ja": "「ママ／パパはどこ？」など、「だれ？」「なに？」「どこ？」「なぜ？」と質問する"
    },
    {
      "en": "Says what action is happening in a picture or book when asked, like \"running\", \"eating\", or \"playing\"",
      "ja": "絵や絵本を見て、何をしている場面か尋ねられると、「走っている」などと答える"
    },
    {
      "en": "Says first name, when asked",
      "ja": "名前を聞かれると自分の下の名前を言える"
    },
    {
      "en": "Talks well enough for others to understand, most of the time",
      "ja": "ほとんどの場合、ほかの人が言葉を理解できるように話す"
    },
    {
      "en": "Draws a circle, when you show him how",
      "ja": "お手本を見せると、丸（円）を描く"
    },
    {
      "en": "Avoids touching hot objects, like a stove, when you warn him",
      "ja": "「熱いよ」と注意すると、ストーブなどの熱いものに触らないように気をつける"
    },
    {
      "en": "Strings items together, like large beads or macaroni",
      "ja": "大きなビーズやマカロニなどをひもに通してつなげる"
    },
    {
      "en": "Puts on some clothes by himself, like loose pants or a jacket",
      "ja": "ズボンや上着など、簡単な服を自分で着る"
    },
    {
      "en": "Uses a fork",
      "ja": "フォークを使って食べる"
    }
  ],
  "4 years": [
    {
      "en": "Pretends to be something else during play (teacher, superhero, dog)",
      "ja": "ごっこ遊びで先生、ヒーロー、動物など別の存在になりきる"
    },
    {
      "en": "Asks to go play with children if none are around, like \"Can I play with Alex?\"",
      "ja": "近くに遊ぶ子がいないとき、「アレックスと遊んでもいい？」などと聞く"
    },
    {
      "en": "Comforts others who are hurt or sad, like hugging a crying friend",
      "ja": "けがをした人や悲しんでいる人を慰める（例：泣いている友達を抱きしめる）"
    },
    {
      "en": "Avoids danger, like not jumping from tall heights at the playground",
      "ja": "遊具の高すぎる場所から飛び降りないなど、危険を回避する"
    },
    {
      "en": "Likes to be a \"helper\"",
      "ja": "「お手伝い役」になるのが好き"
    },
    {
      "en": "Changes behavior based on where he is (place of worship, library, playground)",
      "ja": "いる場所に合わせて行動を変える（図書館や公園など）"
    },
    {
      "en": "Says sentences with four or more words",
      "ja": "4語以上をつなげた文で話す"
    },
    {
      "en": "Says some words from a song, story, or nursery rhyme",
      "ja": "歌や物語、童謡に出てくる言葉をいくつか言う"
    },
    {
      "en": "Talks about at least one thing that happened during his day, like \"I played soccer.\"",
      "ja": "「サッカーをした」など、その日にあったことを少なくとも1つ話す"
    },
    {
      "en": "Answers simple questions like \"What is a coat for?\" or \"What is a crayon for?\"",
      "ja": "「コートは何のため？」「クレヨンは何に使うの？」などの簡単な質問に答える"
    },
    {
      "en": "Names a few colors of items",
      "ja": "物の色をいくつか正しく言える"
    },
    {
      "en": "Tells what comes next in a well-known story",
      "ja": "よく知っている物語の次に起こることを話す"
    },
    {
      "en": "Draws a person with three or more body parts",
      "ja": "頭、胴体、手足など3つ以上の部位がある人の絵を描く"
    },
    {
      "en": "Catches a large ball most of the time",
      "ja": "投げられた大きなボールを、ほとんどの場合は受け止める"
    },
    {
      "en": "Serves himself food or pours water, with adult supervision",
      "ja": "大人の見守りのもと、自分で食べ物をよそったり水を注いだりする"
    },
    {
      "en": "Unbuttons some buttons",
      "ja": "ボタンをいくつか外す"
    },
    {
      "en": "Holds crayon or pencil between fingers and thumb (not a fist)",
      "ja": "クレヨンや鉛筆を、握りこぶしではなく親指とほかの指ではさんで持つ"
    }
  ],
  "5 years": [
    {
      "en": "Follows rules or takes turns when playing games with other children",
      "ja": "ほかの子とゲームをするとき、ルールを守る、または順番を待つ"
    },
    {
      "en": "Sings, dances, or acts for you",
      "ja": "あなたの前で歌・踊り・お芝居のいずれかを見せる"
    },
    {
      "en": "Does simple chores at home, like matching socks or clearing the table after eating",
      "ja": "靴下を組にそろえたり、食後に食器を片づけたりするなど、簡単な家事をする"
    },
    {
      "en": "Tells a story he heard or made up with at least two events. For example, a cat was stuck in a tree and a firefighter saved it",
      "ja": "木に登って降りられなくなった猫を消防士が助ける話など、聞いた話や自分で作った話を2つ以上の出来事を含めて話す"
    },
    {
      "en": "Answers simple questions about a book or story after you read or tell it to him",
      "ja": "本やお話を読んだり聞かせたりした後、その内容についての簡単な質問に答える"
    },
    {
      "en": "Keeps a conversation going with more than three back-and-forth exchanges",
      "ja": "3往復を超えて会話を続ける"
    },
    {
      "en": "Uses or recognizes simple rhymes (bat-cat, ball-tall)",
      "ja": "語尾の音が似た言葉に気づいたり、それを使ったりする"
    },
    {
      "en": "Counts to 10",
      "ja": "1から10まで数える"
    },
    {
      "en": "Names some numbers between 1 and 5 when you point to them",
      "ja": "1〜5の数字を指されると、そのうちのいくつかの名前を言う"
    },
    {
      "en": "Uses words about time, like \"yesterday,\" \"tomorrow,\" \"morning,\" or \"night\"",
      "ja": "「きのう」「あした」「朝」「夜」など、時間に関する言葉を使う"
    },
    {
      "en": "Pays attention for 5 to 10 minutes during activities. For example, during story time or making arts and crafts (screen time does not count)",
      "ja": "読み聞かせや工作など（画面を見る時間は含まない）の活動に5〜10分間集中する"
    },
    {
      "en": "Writes some letters in his name",
      "ja": "自分の名前に使われている文字をいくつか書く"
    },
    {
      "en": "Names some letters when you point to them",
      "ja": "指さした文字のうち、いくつかの名前（読み方）を言う"
    },
    {
      "en": "Buttons some buttons",
      "ja": "服のボタンをいくつか留める"
    },
    {
      "en": "Hops on one foot",
      "ja": "片足でぴょんぴょん跳ぶ"
    }
  ]
};
