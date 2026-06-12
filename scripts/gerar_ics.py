#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Gera um ficheiro .ics com todos os 104 jogos do Mundial 2026.
Horas em hora de Lisboa (convertidas para UTC no ficheiro, para funcionar em
qualquer fuso). Fontes cruzadas: A Bola + Sky Sports (UK == Lisboa no verão).
"""
from datetime import datetime, timedelta

BOLAO = "https://wc26.martinsnuno.com/"

# cidade -> (estádio, país)
STADIUMS = {
    "Mexico City":   ("Estádio Azteca", "Cidade do México, México"),
    "Zapopan":       ("Estádio Akron", "Guadalajara, México"),
    "Guadalupe":     ("Estádio BBVA", "Monterrey, México"),
    "Toronto":       ("BMO Field", "Toronto, Canadá"),
    "Vancouver":     ("BC Place", "Vancouver, Canadá"),
    "Atlanta":       ("Mercedes-Benz Stadium", "Atlanta, EUA"),
    "Foxborough":    ("Gillette Stadium", "Boston/Foxborough, EUA"),
    "Arlington":     ("AT&T Stadium", "Dallas/Arlington, EUA"),
    "Houston":       ("NRG Stadium", "Houston, EUA"),
    "Kansas City":   ("Arrowhead Stadium", "Kansas City, EUA"),
    "Los Angeles":   ("SoFi Stadium", "Los Angeles/Inglewood, EUA"),
    "Miami":         ("Hard Rock Stadium", "Miami, EUA"),
    "New Jersey":    ("MetLife Stadium", "Nova Iorque/Nova Jérsia, EUA"),
    "Philadelphia":  ("Lincoln Financial Field", "Filadélfia, EUA"),
    "Santa Clara":   ("Levi's Stadium", "São Francisco/Santa Clara, EUA"),
    "Seattle":       ("Lumen Field", "Seattle, EUA"),
}

# jogos com transmissão grátis LiveModeTV (YouTube), segundo A Bola
LIVEMODE = {1,3,6,9,13,17,21,31,34,37,41,45,52,56,69,101,102,104}
# jogos de Portugal -> também em sinal aberto (RTP/SIC/TVI)
PORTUGAL = {21,45,69}

# (nº, data 'YYYY-MM-DD', hora 'HH:MM' Lisboa, equipas, fase, cidade)
M = [
 (1,"2026-06-11","20:00","México vs África do Sul","Grupo A","Mexico City"),
 (2,"2026-06-12","03:00","Coreia do Sul vs Rep. Checa","Grupo A","Zapopan"),
 (3,"2026-06-12","20:00","Canadá vs Bósnia-Herzegovina","Grupo B","Toronto"),
 (4,"2026-06-13","02:00","EUA vs Paraguai","Grupo D","Los Angeles"),
 (5,"2026-06-13","20:00","Catar vs Suíça","Grupo B","Santa Clara"),
 (6,"2026-06-13","23:00","Brasil vs Marrocos","Grupo C","New Jersey"),
 (7,"2026-06-14","02:00","Haiti vs Escócia","Grupo C","Foxborough"),
 (8,"2026-06-14","05:00","Austrália vs Turquia","Grupo D","Vancouver"),
 (9,"2026-06-14","18:00","Alemanha vs Curaçao","Grupo E","Houston"),
 (10,"2026-06-14","21:00","Países Baixos vs Japão","Grupo F","Arlington"),
 (11,"2026-06-15","00:00","Costa do Marfim vs Equador","Grupo E","Philadelphia"),
 (12,"2026-06-15","03:00","Suécia vs Tunísia","Grupo F","Guadalupe"),
 (13,"2026-06-15","17:00","Espanha vs Cabo Verde","Grupo H","Atlanta"),
 (14,"2026-06-15","20:00","Bélgica vs Egito","Grupo G","Seattle"),
 (15,"2026-06-15","23:00","Arábia Saudita vs Uruguai","Grupo H","Miami"),
 (16,"2026-06-16","02:00","Irão vs Nova Zelândia","Grupo G","Los Angeles"),
 (17,"2026-06-16","20:00","França vs Senegal","Grupo I","New Jersey"),
 (18,"2026-06-16","23:00","Iraque vs Noruega","Grupo I","Foxborough"),
 (19,"2026-06-17","02:00","Argentina vs Argélia","Grupo J","Kansas City"),
 (20,"2026-06-17","05:00","Áustria vs Jordânia","Grupo J","Santa Clara"),
 (21,"2026-06-17","18:00","Portugal vs RD Congo","Grupo K","Houston"),
 (22,"2026-06-17","21:00","Inglaterra vs Croácia","Grupo L","Arlington"),
 (23,"2026-06-18","00:00","Gana vs Panamá","Grupo L","Toronto"),
 (24,"2026-06-18","03:00","Uzbequistão vs Colômbia","Grupo K","Mexico City"),
 (25,"2026-06-18","17:00","Rep. Checa vs África do Sul","Grupo A","Atlanta"),
 (26,"2026-06-18","20:00","Suíça vs Bósnia-Herzegovina","Grupo B","Los Angeles"),
 (27,"2026-06-18","23:00","Canadá vs Catar","Grupo B","Vancouver"),
 (28,"2026-06-19","02:00","México vs Coreia do Sul","Grupo A","Zapopan"),
 (29,"2026-06-19","20:00","EUA vs Austrália","Grupo D","Seattle"),
 (30,"2026-06-19","23:00","Escócia vs Marrocos","Grupo C","Foxborough"),
 (31,"2026-06-20","01:30","Brasil vs Haiti","Grupo C","Philadelphia"),
 (32,"2026-06-20","04:00","Turquia vs Paraguai","Grupo D","Santa Clara"),
 (33,"2026-06-20","18:00","Países Baixos vs Suécia","Grupo F","Houston"),
 (34,"2026-06-20","21:00","Alemanha vs Costa do Marfim","Grupo E","Toronto"),
 (35,"2026-06-21","01:00","Equador vs Curaçao","Grupo E","Kansas City"),
 (36,"2026-06-21","05:00","Tunísia vs Japão","Grupo F","Guadalupe"),
 (37,"2026-06-21","17:00","Espanha vs Arábia Saudita","Grupo H","Atlanta"),
 (38,"2026-06-21","20:00","Bélgica vs Irão","Grupo G","Los Angeles"),
 (39,"2026-06-21","23:00","Uruguai vs Cabo Verde","Grupo H","Miami"),
 (40,"2026-06-22","02:00","Nova Zelândia vs Egito","Grupo G","Vancouver"),
 (41,"2026-06-22","18:00","Argentina vs Áustria","Grupo J","Arlington"),
 (42,"2026-06-22","22:00","França vs Iraque","Grupo I","Philadelphia"),
 (43,"2026-06-23","01:00","Noruega vs Senegal","Grupo I","Toronto"),
 (44,"2026-06-23","04:00","Jordânia vs Argélia","Grupo J","Santa Clara"),
 (45,"2026-06-23","18:00","Portugal vs Uzbequistão","Grupo K","Houston"),
 (46,"2026-06-23","21:00","Inglaterra vs Gana","Grupo L","Foxborough"),
 (47,"2026-06-24","00:00","Panamá vs Croácia","Grupo L","Foxborough"),
 (48,"2026-06-24","03:00","Colômbia vs RD Congo","Grupo K","Zapopan"),
 (49,"2026-06-24","20:00","Suíça vs Canadá","Grupo B","Vancouver"),
 (50,"2026-06-24","20:00","Bósnia-Herzegovina vs Catar","Grupo B","Seattle"),
 (51,"2026-06-24","23:00","Marrocos vs Haiti","Grupo C","Atlanta"),
 (52,"2026-06-24","23:00","Escócia vs Brasil","Grupo C","Miami"),
 (53,"2026-06-25","02:00","África do Sul vs Coreia do Sul","Grupo A","Guadalupe"),
 (54,"2026-06-25","02:00","Rep. Checa vs México","Grupo A","Mexico City"),
 (55,"2026-06-25","21:00","Curaçao vs Costa do Marfim","Grupo E","Philadelphia"),
 (56,"2026-06-25","21:00","Equador vs Alemanha","Grupo E","New Jersey"),
 (57,"2026-06-26","00:00","Tunísia vs Países Baixos","Grupo F","Kansas City"),
 (58,"2026-06-26","00:00","Japão vs Suécia","Grupo F","Arlington"),
 (59,"2026-06-26","03:00","Turquia vs EUA","Grupo D","Los Angeles"),
 (60,"2026-06-26","03:00","Paraguai vs Austrália","Grupo D","Santa Clara"),
 (61,"2026-06-26","20:00","Noruega vs França","Grupo I","Foxborough"),
 (62,"2026-06-26","20:00","Senegal vs Iraque","Grupo I","Toronto"),
 (63,"2026-06-27","01:00","Cabo Verde vs Arábia Saudita","Grupo H","Houston"),
 (64,"2026-06-27","01:00","Uruguai vs Espanha","Grupo H","Zapopan"),
 (65,"2026-06-27","04:00","Nova Zelândia vs Bélgica","Grupo G","Vancouver"),
 (66,"2026-06-27","04:00","Egito vs Irão","Grupo G","Seattle"),
 (67,"2026-06-27","22:00","Panamá vs Inglaterra","Grupo L","New Jersey"),
 (68,"2026-06-27","22:00","Croácia vs Gana","Grupo L","Philadelphia"),
 (69,"2026-06-28","00:30","Colômbia vs Portugal","Grupo K","Miami"),
 (70,"2026-06-28","00:30","RD Congo vs Uzbequistão","Grupo K","Atlanta"),
 (71,"2026-06-28","03:00","Argélia vs Áustria","Grupo J","Kansas City"),
 (72,"2026-06-28","03:00","Jordânia vs Argentina","Grupo J","Arlington"),
 # ---- Eliminatórias ----
 (73,"2026-06-28","20:00","2.º Grupo A vs 2.º Grupo B","16-avos (32 avos)","Los Angeles"),
 (74,"2026-06-29","21:30","1.º Grupo E vs 3.º lugar","16-avos","Foxborough"),
 (75,"2026-06-30","02:00","1.º Grupo F vs 2.º Grupo C","16-avos","Guadalupe"),
 (76,"2026-06-29","18:00","1.º Grupo C vs 2.º Grupo F","16-avos","Houston"),
 (77,"2026-06-30","22:00","1.º Grupo I vs 3.º lugar","16-avos","New Jersey"),
 (78,"2026-06-30","18:00","2.º Grupo E vs 2.º Grupo I","16-avos","Arlington"),
 (79,"2026-07-01","02:00","1.º Grupo A vs 3.º lugar","16-avos","Mexico City"),
 (80,"2026-07-01","17:00","1.º Grupo L vs 3.º lugar","16-avos","Atlanta"),
 (81,"2026-07-02","01:00","1.º Grupo D vs 3.º lugar","16-avos","Santa Clara"),
 (82,"2026-07-01","21:00","1.º Grupo G vs 3.º lugar","16-avos","Seattle"),
 (83,"2026-07-03","00:00","2.º Grupo K vs 2.º Grupo L","16-avos","Toronto"),
 (84,"2026-07-02","20:00","1.º Grupo H vs 2.º Grupo J","16-avos","Los Angeles"),
 (85,"2026-07-03","04:00","1.º Grupo B vs 3.º lugar","16-avos","Vancouver"),
 (86,"2026-07-03","23:00","1.º Grupo J vs 2.º Grupo H","16-avos","Miami"),
 (87,"2026-07-04","02:30","1.º Grupo K vs 3.º lugar","16-avos","Kansas City"),
 (88,"2026-07-03","19:00","2.º Grupo D vs 2.º Grupo G","16-avos","Arlington"),
 (89,"2026-07-04","22:00","Vencedor J74 vs Vencedor J77","Oitavos","Philadelphia"),
 (90,"2026-07-04","18:00","Vencedor J73 vs Vencedor J75","Oitavos","Houston"),
 (91,"2026-07-05","21:00","Vencedor J76 vs Vencedor J78","Oitavos","New Jersey"),
 (92,"2026-07-06","01:00","Vencedor J79 vs Vencedor J80","Oitavos","Mexico City"),
 (93,"2026-07-06","20:00","Vencedor J83 vs Vencedor J84","Oitavos","Arlington"),
 (94,"2026-07-07","01:00","Vencedor J81 vs Vencedor J82","Oitavos","Seattle"),
 (95,"2026-07-07","17:00","Vencedor J86 vs Vencedor J88","Oitavos","Atlanta"),
 (96,"2026-07-07","21:00","Vencedor J85 vs Vencedor J87","Oitavos","Vancouver"),
 (97,"2026-07-09","21:00","Vencedor J89 vs Vencedor J90","Quartos de final","Foxborough"),
 (98,"2026-07-10","20:00","Vencedor J93 vs Vencedor J94","Quartos de final","Los Angeles"),
 (99,"2026-07-11","22:00","Vencedor J91 vs Vencedor J92","Quartos de final","Miami"),
 (100,"2026-07-12","02:00","Vencedor J95 vs Vencedor J96","Quartos de final","Kansas City"),
 (101,"2026-07-14","20:00","Vencedor J97 vs Vencedor J98","Meia-final","Arlington"),
 (102,"2026-07-15","20:00","Vencedor J99 vs Vencedor J100","Meia-final","Atlanta"),
 (103,"2026-07-18","22:00","Perdedor J101 vs Perdedor J102","3.º/4.º lugar","Miami"),
 (104,"2026-07-19","20:00","Vencedor J101 vs Vencedor J102","FINAL","New Jersey"),
]

def esc(s):
    return s.replace("\\","\\\\").replace(";","\\;").replace(",","\\,").replace("\n","\\n")

def tv_line(n):
    parts = ["Sport TV"]
    if n in LIVEMODE:
        parts.append("LiveModeTV (YouTube, grátis)")
    if n in PORTUGAL:
        parts.append("sinal aberto RTP/SIC/TVI (canal a confirmar)")
    return " + ".join(parts)

lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Nuno Martins//Mundial 2026//PT",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Mundial 2026 ⚽",
    "X-WR-TIMEZONE:Europe/Lisbon",
    "X-WR-CALDESC:Todos os 104 jogos do Mundial 2026 (horas de Lisboa). Bolão: " + BOLAO,
]

DTSTAMP = "20260602T000000Z"
for n,d,t,teams,phase,city in M:
    stadium, loc = STADIUMS[city]
    # Lisboa (UTC+1 no verão) -> UTC
    start_local = datetime.strptime(d+" "+t, "%Y-%m-%d %H:%M")
    start_utc = start_local - timedelta(hours=1)
    end_utc = start_utc + timedelta(hours=2)
    fmt = lambda x: x.strftime("%Y%m%dT%H%M%SZ")
    emoji = "\U0001F3C6" if phase in ("FINAL","3.º/4.º lugar","Meia-final","Quartos de final") else "⚽"
    summary = f"{emoji} {teams} ({phase})"
    tv = tv_line(n)
    desc = (f"Jogo {n} — {phase}\\n"
            f"\\n\U0001F3DF️ Estádio: {stadium}"
            f"\\n\U0001F4CD Local: {loc}"
            f"\\n\U0001F4FA Onde ver: {tv}"
            f"\\n\\n\U0001F3AF Bolão da app: {BOLAO}")
    lines += [
        "BEGIN:VEVENT",
        f"UID:wc2026-jogo-{n}@martinsnuno.com",
        f"DTSTAMP:{DTSTAMP}",
        f"DTSTART:{fmt(start_utc)}",
        f"DTEND:{fmt(end_utc)}",
        f"SUMMARY:{esc(summary)}",
        f"LOCATION:{esc(stadium + ', ' + loc)}",
        f"DESCRIPTION:{desc}",
        f"URL:{BOLAO}",
        "BEGIN:VALARM","TRIGGER:-PT30M","ACTION:DISPLAY",
        f"DESCRIPTION:{esc(teams + ' daqui a 30 min')}","END:VALARM",
        "END:VEVENT",
    ]

lines.append("END:VCALENDAR")

# linhas longas: o RFC pede folding a 75 octetos, mas a maioria dos clientes
# aceita linhas longas. Mantemos simples e usamos CRLF.
out = "\r\n".join(lines) + "\r\n"
import os
dest = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", "mundial2026.ics")
with open(dest, "w", encoding="utf-8") as f:
    f.write(out)
print(f"OK: {len(M)} jogos escritos em {dest}")
