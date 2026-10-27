"""Render the public HTML and illustrated PDF from partner-guide/guide.json.
Run: python3 scripts/build-partner-guide.py (requires ReportLab).
Screenshots are original product captures with intercepted fictional accounts.
"""
from pathlib import Path
import json, html, os
from xml.sax.saxutils import escape
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor, Color, white
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph
from reportlab.lib.utils import ImageReader

FONT_DIR=Path(os.environ.get('PD_GUIDE_FONT_DIR','/usr/share/fonts/truetype/dejavu'))
pdfmetrics.registerFont(TTFont('GuideSans',str(FONT_DIR/'DejaVuSans.ttf')))
pdfmetrics.registerFont(TTFont('GuideSans-Bold',str(FONT_DIR/'DejaVuSans-Bold.ttf')))
pdfmetrics.registerFontFamily('GuideSans',normal='GuideSans',bold='GuideSans-Bold',italic='GuideSans',boldItalic='GuideSans-Bold')
ROOT=Path(__file__).resolve().parents[1]
PUBLIC=ROOT/'public'; DATA=PUBLIC/'partner-guide'; guide=json.loads((DATA/'guide.json').read_text())
BASE='https://repformed.com/'
e=lambda v:html.escape(v,quote=True)
role_rows=''.join(f'<tr><th scope="row">{e(r)}</th><td>{e(t)}</td></tr>' for r,t in guide['roles'])
nav=''.join(f'<a href="#{c["id"]}"><span>{i:02}</span>{e(c["title"].rstrip("."))}</a>' for i,c in enumerate(guide['chapters'],1))
chapters=[]
for i,c in enumerate(guide['chapters'],1):
    roles=f'<div class="roles"><h3>Five account levels</h3><table><caption>Permissions at a glance</caption><thead><tr><th scope="col">Level</th><th scope="col">Main tools</th></tr></thead><tbody>{role_rows}</tbody></table></div>' if c['id']=='workspace' else ''
    chapters.append(f'''<section class="chapter" id="{c['id']}" aria-labelledby="heading-{i}">
<div class="chapter-heading"><p class="eyebrow">{i:02} / {e(c['eyebrow'])}</p><h2 id="heading-{i}">{e(c['title'])}</h2><p class="intro">{e(c['intro'])}</p></div>
<div class="chapter-body"><div class="instruction"><ol>{''.join('<li>'+e(s)+'</li>' for s in c['steps'])}</ol><aside class="tip"><strong>Good to know</strong><p>{e(c['tip'])}</p></aside></div>
<figure class="{'wide' if c['id']=='website' else 'phone'}"><a href="./partner-guide/{c['image']}" aria-label="Open larger image: {e(c['imageAlt'])}"><img src="./partner-guide/{c['image']}" alt="{e(c['imageAlt'])}" loading="lazy" width="{'1360' if c['id']=='website' else '390'}" height="{'900' if c['id']=='website' else '844'}"></a><figcaption>{e(c['caption'])} Tap or click the image to enlarge.</figcaption></figure></div>{roles}<a class="back" href="#contents">Back to chapters ↑</a></section>''')
faq=''.join(f'<details><summary>{e(q)}</summary><p>{e(a)}</p></details>' for q,a in guide['questions'])
page=f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="An illustrated guide to the Repformed website and iPhone app: login, uploads, approval, workout assignment, practice and private video review."><meta name="theme-color" content="#181818"><title>Repformed — Partner walkthrough</title><link rel="icon" href="./favicon.svg"><link rel="stylesheet" href="./partner-guide/guide.css"><script src="./partner-guide/share.js" defer></script><link rel="stylesheet" href="./social-links.css"><script src="./social-links.js" defer></script></head>
<body><a class="skip" href="#main">Skip to walkthrough</a>
<header class="top"><a class="brand" href="./"><img class="guide-brand-mark" src="./brand/repformed-mark.svg" alt="" width="48" height="36"><span>Repformed<small>THE PARTNER WALKTHROUGH</small></span></a><a class="button small" href="./partner-guide.pdf">Download PDF</a></header>
<main id="main"><section class="hero"><div><p class="eyebrow">WEBSITE + iPHONE APP / 8–10 MINUTE READ</p><h1>{e(guide['title'])}</h1><p class="hero-lead">{e(guide['subtitle'])}</p><div class="actions"><a class="button" href="#website">Start the walkthrough <span aria-hidden="true">↗</span></a><button class="button ghost" id="copy-link" type="button">Copy share link</button></div><p id="share-status" role="status" class="share-status"></p><div id="manual-share" hidden><label for="guide-link">Copy this guide link</label><input id="guide-link" readonly value="{BASE}partner-guide.html"></div><p class="baseline">{e(guide['baseline'])}</p></div><div class="hero-route"><p class="eyebrow">THE WHOLE FLOW</p><ol><li><span>01</span>Upload a drill</li><li><span>02</span>Review & approve</li><li><span>03</span>Build & assign</li><li><span>04</span>Practice & return</li></ol><a href="./" class="text-link">Open the website ↗</a></div></section>
<div class="preview-note"><strong>A real product walkthrough. Fictional information.</strong><p>{e(guide['notice'])} Native iPhone-only steps are called out in the instructions.</p></div>
<div class="layout"><nav class="toc" id="contents" aria-label="Walkthrough chapters"><p class="eyebrow">IN THIS GUIDE</p>{nav}<a href="#quick-start"><span>10</span>Try it together</a><a href="#questions"><span>?</span>Common questions</a></nav>
<div class="chapters">{''.join(chapters)}
<section class="chapter final" id="quick-start" aria-labelledby="quick-heading"><p class="eyebrow">YOUR FIRST RUN / 15–20 MINUTES</p><h2 id="quick-heading">Try one session together.</h2><p class="intro">Use one Owner phone, one separate approved adult customer account and one original adult noncontact recording. Your partner needs their own approved TestFlight access to install the native app.</p><ol class="run"><li>Owner: upload one drill, send it for review and approve its release after the required checks.</li><li>Owner: build and save a compatible workout, then preview and confirm its assignment.</li><li>Customer: refresh Today, begin practice, save and leave, then reopen and resume.</li><li>Customer: finish and check Progress. If video review is enabled, try a private clip and assigned-coach feedback.</li></ol><div class="actions"><a class="button" href="./phone-test.html">Open the phone checklist ↗</a><a class="button ghost" href="./?source=app#app">Open your workspace ↗</a></div><aside class="tip"><strong>Current pilot limits</strong><p>Public registration, subscriptions and real junior access remain closed. Actual camera/audio, recording orientation, real upload/deletion and interrupted/background behavior still need physical-device acceptance. Qualified training review, privacy/consent and billing decisions are separate launch work.</p></aside></section>
<section class="chapter questions" id="questions" aria-labelledby="question-heading"><p class="eyebrow">WHEN SOMETHING DOES NOT LOOK RIGHT</p><h2 id="question-heading">A few quick answers.</h2>{faq}</section>
</div></div></main><footer><a class="brand" href="./"><img class="guide-brand-mark" src="./brand/repformed-mark.svg" alt="" width="48" height="36"><span>Repformed<small>PRIVATE PILOT · FOOTBALL FIRST</small></span></a><p>This guide explains the product; it does not provide a training prescription. All sample activities await qualified review.</p><a href="./partner-guide.pdf">Download the illustrated PDF</a></footer><div class="standalone-socials" data-social-links hidden></div></body></html>'''
arrow='<svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M7 17 17 7M7 7h10v10"/></svg>'
page=page.replace('↗',arrow).replace('Back to chapters ↑','Back to chapters')
(PUBLIC/'partner-guide.html').write_text(page)

# PDF: a presentation-style page per chapter, plus cover and reference pages.
W,H=792,612; M=34; INK=HexColor('#15191a'); ACCENT=HexColor('#c7a45c'); MUTED=HexColor('#586164'); PAPER=HexColor('#faf5ea')
PDF=PUBLIC/'partner-guide.pdf'; cv=canvas.Canvas(str(PDF),pagesize=(W,H),pageCompression=1)
cv.setTitle('Repformed — Partner walkthrough'); cv.setAuthor('Repformed'); cv.setSubject('Illustrated website and iPhone guide using fictional accounts')
page_num=0

def ascii_text(s):
    for a,b in [('→',' > '),('↗',''),('↑',''),('–','-'),('—','-'),('’',"'"),('‘',"'"),('“','"'),('”','"')]:s=s.replace(a,b)
    return s

def para(s,x,y,width,size=11,leading=None,bold=False,color=INK):
    style=ParagraphStyle('p',fontName='GuideSans-Bold' if bold else 'GuideSans',fontSize=size,leading=leading or size*1.4,textColor=color,spaceAfter=0)
    p=Paragraph(escape(ascii_text(s)),style);_,h=p.wrap(width,1000);p.drawOn(cv,x,y-h);return y-h

def start(label):
    global page_num
    page_num+=1;cv.setFillColor(PAPER);cv.rect(0,0,W,H,fill=1,stroke=0)
    cv.drawImage(str(PUBLIC/'icons/app-192.png'),M,H-48,width=29,height=29,mask='auto')
    cv.setFillColor(INK);cv.setFont('GuideSans-Bold',10);cv.drawString(M+39,H-30,'REPFORMED')
    cv.setFont('GuideSans',8);cv.setFillColor(MUTED);cv.drawRightString(W-M,H-29,ascii_text(label))
    cv.setStrokeColor(HexColor('#dddcd8'));cv.line(M,33,W-M,33);cv.setFont('GuideSans',8);cv.drawString(M,19,'WEBSITE + iPHONE / PRIVATE PILOT / FICTIONAL ACCOUNT PREVIEWS');cv.drawRightString(W-M,19,f'{page_num:02}')
    cv.linkURL(BASE+'partner-guide.html',(M,10,W-M,30),relative=0,thickness=0)

def finish():cv.showPage()
def link(text,url,x,y,width=300):
    para(text,x,y,width,size=11,bold=True);cv.linkURL(url,(x,y-20,x+width,y+4),relative=0,thickness=0)

start('THE PARTNER WALKTHROUGH');cv.bookmarkPage('cover')
y=para('Your first session.',M,524,445,size=34,leading=40,bold=True);y=para('From upload to finish.',M,y-4,445,size=34,leading=40,bold=True)
y=para(guide['subtitle'],M,y-20,408,size=14,leading=21)
y=para('Read together in 8-10 minutes. Then try one real workflow in 15-20 minutes.',M,y-17,408,size=12,leading=18)
link('Open the shareable phone guide',BASE+'partner-guide.html',M,y-22,350)
link('Open the public website',BASE,M,y-53,350)
cv.drawImage(str(DATA/'owner.jpg'),557,119,width=177,height=383,preserveAspectRatio=True,mask='auto')
para('APP WORKSPACE PREVIEW / FICTIONAL OWNER',540,104,210,size=8,color=MUTED)
y=para('YOUR ROUTE',M,237,400,size=9,bold=True,color=MUTED)
for i,line in enumerate(['Website + app login','Upload > review > build > assign','Customer practice + optional private review']):
    cv.setFillColor(ACCENT);cv.circle(M+7,y-17,7,fill=1,stroke=0);y=para(line,M+24,y-8,425,size=12,bold=True)-14
para(guide['baseline'],M,83,480,size=9,color=MUTED);finish()

for i,c in enumerate(guide['chapters'],1):
    start(f'{i:02} / '+c['eyebrow']);cv.bookmarkPage(c['id']);cv.addOutlineEntry(c['title'],c['id'],0,False)
    y=para(c['title'],M,530,505,size=30,leading=33,bold=True)
    y=para(c['intro'],M,y-13,498,size=11.5,leading=16)-17
    for n,s in enumerate(c['steps'],1):
        cv.setFillColor(ACCENT);cv.circle(M+7,y-7,8,fill=1,stroke=0);cv.setFillColor(INK);cv.setFont('GuideSans-Bold',8);cv.drawCentredString(M+7,y-10,str(n))
        y=para(s,M+25,y+1,470,size=10.5,leading=14.6)-12
    tip_style=ParagraphStyle('tip',fontName='GuideSans',fontSize=9.4,leading=12.6,textColor=INK)
    tip=Paragraph('<b>GOOD TO KNOW</b><br/>'+escape(ascii_text(c['tip'])),tip_style);_,th=tip.wrap(476,1000)
    bottom=y-th-18
    assert bottom>43,(c['id'],bottom)
    cv.setFillColor(HexColor('#f1e5dc'));cv.roundRect(M,bottom,500,th+16,6,fill=1,stroke=0);tip.drawOn(cv,M+12,bottom+8)
    img=ImageReader(str(DATA/c['image']));iw,ih=img.getSize();dw=180;dh=dw*ih/iw;top=516
    cv.drawImage(img,570,top-dh,width=dw,height=dh,mask='auto')
    capy=para(c['caption'],565,top-dh-11,190,size=9,leading=12,color=MUTED)
    para('Fictional account / browser workspace preview.' if c['id']!='website' else 'Public website capture.',565,capy-8,190,size=8.3,leading=11.5,color=MUTED)
    cv.linkURL(BASE+'partner-guide/'+c['image'],(570,top-dh,750,top),relative=0,thickness=0)
    finish()

start('QUICK REFERENCE / ACCESS + FIRST RUN');cv.bookmarkPage('reference');y=para('Who does what?',M,529,720,size=30,bold=True)
for role,desc in guide['roles']:
    y-=14;y=para(role,M,y,100,size=12,bold=True);y=para(desc,M+112,y+16,600,size=11)-5
    cv.setStrokeColor(HexColor('#dddcd8'));cv.line(M,y,W-M,y)
y-=25;y=para('Try one session together.',M,y,720,size=23,bold=True)
y=para('Owner phone + separate approved adult customer account + original adult noncontact recording. Your partner also needs approved TestFlight access to install the native app.',M,y-13,710,size=12)-12
for s in ['Upload a drill > submit for review > approve after release checks.','Build the workout > preview eligibility > confirm its assignment.','Customer: begin > save and leave > reopen > resume > finish > check Progress.']:
    y=para(s,M,y,710,size=11.5)-10
link('Open the full two-phone checklist',BASE+'phone-test.html',M,y-8,460)
para('Real junior enrollment/media, public signup and billing remain closed. Staff approval is separate from qualified coaching review. Participation is not proof of athletic improvement.',M,86,710,size=10,color=MUTED);finish()

start('QUICK REFERENCE / QUESTIONS');y=para('If you get stuck.',M,530,720,size=30,bold=True)-14
for q,a in guide['questions']:
    y=para(q,M,y,710,size=12,bold=True)-4;y=para(a,M,y,710,size=10.5,leading=14)-17
assert y>42,y
para('PDF typeface: DejaVu Sans. Font license: '+BASE+'partner-guide/font-license.txt',M,54,710,size=7,color=MUTED)
finish()
start('CONTACT + OFFICIAL SOCIAL ACCOUNTS')
y=para('Stay connected.',M,530,710,size=30,bold=True)-25
link('Contact the Repformed team',BASE+'#contact',M,y,650);y-=38
link('Repformed@gmail.com','mailto:Repformed@gmail.com',M,y,650);y-=45
for account in json.loads((PUBLIC/'social-links.json').read_text())['links']:
    link(account['platform']+' - '+account['url'],account['url'],M,y,700);y-=38
para('Screenshots in this guide are historical fictional browser previews from build 10. Updated branding does not mean a new native iPhone build has been distributed.',M,110,710,size=11,color=MUTED)
finish();cv.save()
print(f'Built public/partner-guide.html and {page_num}-page PDF ({PDF.stat().st_size:,} bytes).')
