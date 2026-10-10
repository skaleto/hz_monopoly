#!/usr/bin/env python3
"""Export the current playable profile into a dependency-free Excel workbook."""

from __future__ import annotations

import json
import math
import subprocess
import zipfile
from pathlib import Path
from xml.sax.saxutils import escape


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs" / "design" / "杭城合伙局-数值设计-v0.6.4.xlsx"
BASELINE_COMMIT = "260e57d697a0da5364983c1424e17f3d41417041"


def load_rules() -> dict:
    script = """
const core = require('./game-core');
const { profiles } = require('./sims/profiles');
const pkg = require('./package.json');
const active = profiles.cautious;
const normalized = core.createGame([{ id: 'doc-a', nickname: '文档甲' }, { id: 'doc-b', nickname: '文档乙' }], { board: active.board, balance: active.balance });
process.stdout.write(JSON.stringify({
  version: pkg.version,
  rulesetVersion: core.CURRENT_RULESET_VERSION,
  board: active.board,
  balance: normalized.balance,
  botPolicy: active.botPolicy,
  dailyEvents: core.DAILY_EVENTS,
  itemCards: core.ITEM_CARDS
}));
"""
    result = subprocess.run(
        ["node", "-e", script], cwd=ROOT, check=True, capture_output=True, text=True
    )
    return json.loads(result.stdout)


def route_name(tile: dict) -> str:
    return {"water": "水上巴士内环", "metro": "地铁快线内环"}.get(tile.get("inner"), "外环")


def next_text(board: list[dict], tile: dict) -> str:
    values = []
    for item in tile.get("next", []):
        index = item["to"] if isinstance(item, dict) else item
        label = item.get("label") if isinstance(item, dict) else board[index]["name"]
        values.append(f"{index} {label}")
    return " / ".join(values)


def js_round(value: float) -> int:
    """Match Math.round for the non-negative economy values in this workbook."""
    return math.floor(value + 0.5)


def node_effect(tile: dict, balance: dict) -> str:
    node_type = tile["type"]
    if node_type == "start":
        return "每次经过或停在此处，按轮次领取月度收入"
    if node_type == "property":
        return "无主时可独资或五五合伙投资；到访他人项目时支付分红"
    if node_type == "opportunity":
        return "二选一：冒险投入 100，或稳妥获得 40"
    if node_type == "daily":
        return "等概率触发 1 个杭城日常事件"
    if node_type == "review":
        return f"支付 {balance['reviewCost']} 金币加急，或停留下一回合"
    if node_type == "vote":
        return f"个人影响力 +{balance['voteInfluence']}，或全员金币 +{balance['voteCash']}"
    if node_type == "park":
        return "金币 +80，影响力 +2"
    if node_type == "landmark":
        return "金币 +100，影响力 +2"
    if node_type == "transit":
        return "金币 +40，影响力 +1；部分交通节点连接内环岔路"
    if node_type == "supply":
        return f"等概率获得 1 张道具；持有满 3 张时兑换 {balance['overflowItemCash']} 金币"
    return ""


def build_sheets(data: dict) -> list[tuple[str, list[list[object]]]]:
    board = data["board"]
    balance = data["balance"]
    bonuses = balance["sectorBonuses"]
    upgrade = balance["upgrade"]
    multipliers = balance["rentMultiplierByLevel"]

    type_names = {
        "start": "起点",
        "property": "可投资项目",
        "opportunity": "城市机遇",
        "daily": "杭城日常",
        "review": "项目验收",
        "vote": "城市公投",
        "park": "城市公园",
        "landmark": "城市地标",
        "transit": "交通换乘",
        "supply": "道具补给",
    }
    type_counts: dict[str, int] = {}
    for tile in board:
        type_counts[tile["type"]] = type_counts.get(tile["type"], 0) + 1

    overview = [
        ["字段", "当前值", "说明"],
        ["产品版本", data["version"], "当前线上数值基线"],
        ["规则版本", data["rulesetVersion"], "新建房间使用的权威规则标识"],
        ["基线 Commit", BASELINE_COMMIT, "本工作簿从该生产基线代码读取"],
        ["文档日期", "2026-10-10", "试玩反馈盘点日期"],
        ["适用范围", "cautious 当前玩法", "不包含 target/aggressive 候选参数"],
        ["棋盘规模", len(board), "含外环与两条交通内环"],
        ["可投资项目", type_counts.get("property", 0), "5 个板块，每板块 5 个项目"],
        ["使用说明", "所有百分比与金额均为当前实际值", "后续调数值时先更新代码，再重新导出此表"],
    ]

    node_types = [["类型代码", "用户名称", "节点数", "停留效果", "是否需要玩家选择"]]
    choice_types = {"property", "opportunity", "review", "vote"}
    for node_type in type_names:
        sample = next(tile for tile in board if tile["type"] == node_type)
        node_types.append([
            node_type,
            type_names[node_type],
            type_counts.get(node_type, 0),
            node_effect(sample, balance),
            "是" if node_type in choice_types else "否",
        ])

    map_rows = [["序号", "路线", "节点类型", "节点名称", "产业板块", "投资价", "基础分红", "下一节点", "停留效果/说明"]]
    for index, tile in enumerate(board):
        map_rows.append([
            index,
            route_name(tile),
            type_names[tile["type"]],
            tile["name"],
            tile.get("group", ""),
            tile.get("price", ""),
            tile.get("rent", ""),
            next_text(board, tile),
            node_effect(tile, balance),
        ])

    project_rows = [[
        "板块", "项目序号", "项目名称", "路线", "投资价", "1级分红", "2级分红",
        "3级分红", "2项板块增益后1级分红", "1→2级建设费", "2→3级建设费",
    ]]
    for index, tile in enumerate(board):
        if tile["type"] != "property":
            continue
        rent = tile["rent"]
        project_rows.append([
            tile["group"],
            index,
            tile["name"],
            route_name(tile),
            tile["price"],
            js_round(rent * multipliers[1]),
            js_round(rent * multipliers[2]),
            js_round(rent * multipliers[3]),
            js_round(rent * bonuses["rentMultiplier"]),
            math.ceil(tile["price"] * upgrade["ratioByCurrentLevel"]["1"]),
            math.ceil(tile["price"] * upgrade["ratioByCurrentLevel"]["2"]),
        ])

    rent_percent = round((bonuses["rentMultiplier"] - 1) * 100)
    sector_rows = [
        ["参与项目数", "档位", "本档新解锁", "实际效果", "作用范围", "是否累计"],
        [0, "未进入", "无", "无板块增益", "无", "-"],
        [1, "进入板块", "点亮进度", "显示已参与该板块", "仅展示", "是"],
        [bonuses["rentMinProjects"], "协同分红", f"分红 +{rent_percent}%", f"该板块所有参与项目的到访分红 ×{bonuses['rentMultiplier']}", "仅该板块", "是"],
        [bonuses["flagshipMinProjects"], "旗舰建设", "解锁 3 级", "该板块项目允许从 2 级建设到 3 级", "仅该板块", "是"],
        [bonuses["scoreMinProjects"], "板块主导", f"城市分 +{bonuses['scoreBonus']}", "结算时增加城市分", "该板块贡献一次", "是"],
        [5, "板块集齐", "无新增数值", "保持 4 档全部累计增益", "仅该板块", "是"],
    ]

    daily_rows = [["事件名称", "金币变化", "影响力变化", "触发概率", "用户可见结果"]]
    probability = f"{100 / len(data['dailyEvents']):g}%"
    for event in data["dailyEvents"]:
        changes = []
        if event["cash"]:
            changes.append(f"金币 {event['cash']:+d}")
        if event["influence"]:
            changes.append(f"影响力 {event['influence']:+d}")
        daily_rows.append([event["text"], event["cash"], event["influence"], probability, "，".join(changes) or "无数值变化"])

    opportunity = balance["opportunity"]
    event_rows = [
        ["场景", "选项/触发", "金币效果", "影响力效果", "其他效果", "备注"],
        ["城市机遇", "稳妥接单", opportunity["safeCash"], 0, "立即结束选择", "确定收益"],
        ["城市机遇", "冒险成功", opportunity["successPayout"] - opportunity["riskCost"], opportunity["successInfluence"], "成功率 60%", f"先扣 {opportunity['riskCost']}，再返还 {opportunity['successPayout']}"],
        ["城市机遇", "冒险失败", -opportunity["riskCost"], opportunity["failureInfluence"], "失败率 40%", "无返还"],
        ["项目验收", "加急", -balance["reviewCost"], 0, "不跳过下回合", "立即完成"],
        ["项目验收", "停留", 0, 0, "下一回合跳过掷骰", "停留期间仍可收分红"],
        ["城市公投", "发展文旅", 0, balance["voteInfluence"], "仅自己", "影响力直接计入城市分"],
        ["城市公投", "全民券", balance["voteCash"], 0, "每位玩家都获得", "表中金币为每人变化"],
        ["经过起点", "第 1–4 轮", 200, 0, "月度收入", "经过或停在起点时触发"],
        ["经过起点", "第 5–9 轮", 150, 0, "月度收入", "经过或停在起点时触发"],
        ["经过起点", "第 10–12 轮", 100, 0, "月度收入", "经过或停在起点时触发"],
        ["城市地标", "停留", 100, 2, "固定奖励", "钱塘潮"],
        ["城市公园", "停留", 80, 2, "固定奖励", "公共城市空间"],
        ["交通换乘", "停留", 40, 1, "固定奖励", "岔路在后续移动时选择"],
        ["道具补给", "道具栏未满", 0, 0, "随机获得 1 张道具", "最多携带 3 张"],
        ["道具补给", "道具栏已满", balance["overflowItemCash"], 0, "抽到的道具自动兑换", "不增加道具"],
        ["到访分红", "停在他人项目", "按项目等级与板块增益支付", 0, "独资全收；合伙五五分", "通行券可减半"],
        ["城市重组", "金币结算后小于 0", balance["restructureCash"], -balance["restructureInfluencePenalty"], "金币直接重置为保底值", "影响力最低为 0"],
    ]

    item_usage = {
        "coffee": ("自己", "自己的回合、掷骰前", "下一次骰子总步数 +2，可与骰子结果叠加"),
        "exact_dice": ("自己", "自己的回合、掷骰前", "选择 1–6，下一次掷骰使用指定点数"),
        "coupon": ("自己", "自己的回合、掷骰前", "立即金币 +180"),
        "build_coupon": ("自己", "自己的回合、掷骰前", "下一次建设费用减半，使用建设后消耗效果"),
        "pass": ("自己", "自己的回合、掷骰前", "下一次支付到访分红时减半，向上取整"),
        "shield": ("自己", "自己的回合、掷骰前", "抵消下一张针对自己的强拆令"),
        "demolition": ("对手项目", "自己的回合、掷骰前", "指定 2 级或 3 级对手项目降低 1 级；产权不变"),
    }
    item_rows = [["卡片 ID", "卡片名称", "类型", "目标", "使用时机", "实际效果", "补给站抽取概率"]]
    for card in data["itemCards"]:
        target, timing, effect = item_usage[card["id"]]
        item_rows.append([
            card["id"],
            card["name"],
            "使坏卡" if card["id"] == "demolition" else "增益卡",
            target,
            timing,
            effect,
            f"1/{len(data['itemCards'])}",
        ])

    bot = data["botPolicy"]
    economy_rows = [
        ["类别", "参数", "当前值", "说明"],
        ["开局", "行动顺序", "随机", "每局随机先手，其余玩家按席位循环"],
        ["开局", "每位初始金币", 1500, "当前 M2 不再按席位补偿"],
        ["局长", "最大轮数", balance["maxRounds"], "达到后按城市分结算"],
        ["局长", "当前轮次边界", "回到席位 0 时加轮次", "随机先手不是席位 0 时，部分席位实际会少行动 1 次；本次仅记录现状，未改规则"],
        ["建设", "1级分红倍率", multipliers[1], "项目投资后即为 1 级"],
        ["建设", "2级分红倍率", multipliers[2], "相对项目基础分红"],
        ["建设", "3级分红倍率", multipliers[3], "需在本板块参与至少 3 个项目"],
        ["建设", "1→2级费用", "项目价 ×45% 向上取整", "建设折扣券可减半"],
        ["建设", "2→3级费用", "项目价 ×70% 向上取整", "建设折扣券可减半"],
        ["计分", "影响力", "1 点 = 1 城市分", "实时计入"],
        ["计分", "独资项目", balance["ownedProjectScore"], "每个项目基础分"],
        ["计分", "合伙项目基础分", balance["partneredProjectScore"], "每位参与者"],
        ["计分", "合伙附加分", balance["partnershipScore"], "每个合伙项目、每位参与者"],
        ["计分", "项目升级", "每升 1 级 +1", "1 级不加升级分"],
        ["计分", "板块主导", bonuses["scoreBonus"], "同板块参与 4 个项目"],
        ["计分", "现金折分", f"每 {balance['cashScoreDivisor']} 金币 +1，最多 +{balance['cashScoreCap']}", "向下取整"],
        ["Bot", "发起合伙概率", f"{round(bot['partnershipRate'] * 100)}%", "满足投资条件时"],
        ["Bot", "开始建设轮次", bot["upgradeAfterRound"], "达到该轮次后考虑建设"],
        ["Bot", "每人最多建设", bot["maxUpgradesPerPlayer"], "当前策略上限"],
        ["Bot", "保留现金", bot["reserveCash"], "投资/建设后需保留"],
    ]

    return [
        ("版本说明", overview),
        ("节点类型", node_types),
        ("地图节点", map_rows),
        ("板块项目", project_rows),
        ("板块增益", sector_rows),
        ("随机日常", daily_rows),
        ("事件与选择", event_rows),
        ("道具卡", item_rows),
        ("经济与计分", economy_rows),
    ]


def column_name(index: int) -> str:
    result = ""
    while index:
        index, remainder = divmod(index - 1, 26)
        result = chr(65 + remainder) + result
    return result


def cell_xml(row: int, column: int, value: object, style: int) -> str:
    reference = f"{column_name(column)}{row}"
    if isinstance(value, bool):
        return f'<c r="{reference}" s="{style}" t="b"><v>{1 if value else 0}</v></c>'
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return f'<c r="{reference}" s="{style}"><v>{value}</v></c>'
    text = escape(str(value if value is not None else ""))
    return f'<c r="{reference}" s="{style}" t="inlineStr"><is><t xml:space="preserve">{text}</t></is></c>'


def sheet_xml(rows: list[list[object]]) -> str:
    max_columns = max(len(row) for row in rows)
    widths = []
    for column in range(max_columns):
        values = [str(row[column]) if column < len(row) else "" for row in rows]
        width = min(42, max(10, max(len(value) for value in values) * 1.4 + 2))
        widths.append(f'<col min="{column + 1}" max="{column + 1}" width="{width:.1f}" customWidth="1"/>')
    row_xml = []
    for row_index, row in enumerate(rows, start=1):
        cells = "".join(cell_xml(row_index, column, value, 1 if row_index == 1 else 2) for column, value in enumerate(row, start=1))
        height = ' ht="30" customHeight="1"' if row_index == 1 else ""
        row_xml.append(f'<row r="{row_index}"{height}>{cells}</row>')
    dimension = f"A1:{column_name(max_columns)}{len(rows)}"
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        f'<dimension ref="{dimension}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
        '<sheetFormatPr defaultRowHeight="18"/><cols>' + "".join(widths) + '</cols><sheetData>' + "".join(row_xml) + '</sheetData>'
        f'<autoFilter ref="{dimension}"/><pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/>'
        '</worksheet>'
    )


def styles_xml() -> str:
    return '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2"><font><sz val="11"/><name val="Aptos"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Aptos"/></font></fonts>
  <fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF17304F"/><bgColor indexed="64"/></patternFill></fill></fills>
  <borders count="2"><border/><border><left style="thin"><color rgb="FFD6DCE4"/></left><right style="thin"><color rgb="FFD6DCE4"/></right><top style="thin"><color rgb="FFD6DCE4"/></top><bottom style="thin"><color rgb="FFD6DCE4"/></bottom></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>'''


def write_entry(archive: zipfile.ZipFile, name: str, content: str) -> None:
    info = zipfile.ZipInfo(name, date_time=(2026, 10, 10, 0, 0, 0))
    info.compress_type = zipfile.ZIP_DEFLATED
    info.external_attr = 0o644 << 16
    archive.writestr(info, content.encode("utf-8"))


def write_workbook(sheets: list[tuple[str, list[list[object]]]]) -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    workbook_sheets = "".join(f'<sheet name="{escape(name)}" sheetId="{index}" r:id="rId{index}"/>' for index, (name, _) in enumerate(sheets, start=1))
    workbook = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>{workbook_sheets}</sheets></workbook>'''
    relationships = "".join(f'<Relationship Id="rId{index}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet{index}.xml"/>' for index in range(1, len(sheets) + 1))
    relationships += f'<Relationship Id="rId{len(sheets) + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
    workbook_rels = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">{relationships}</Relationships>'''
    overrides = "".join(f'<Override PartName="/xl/worksheets/sheet{index}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' for index in range(1, len(sheets) + 1))
    content_types = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>{overrides}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>'''
    root_rels = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>'''
    core = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>杭城合伙局数值设计 v0.6.4</dc:title><dc:creator>Coding Agent（TRAE）</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">2026-10-10T00:00:00Z</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">2026-10-10T00:00:00Z</dcterms:modified></cp:coreProperties>'''
    app = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Hangzhou Partners</Application><TitlesOfParts><vt:vector size="{len(sheets)}" baseType="lpstr">{"".join(f"<vt:lpstr>{escape(name)}</vt:lpstr>" for name, _ in sheets)}</vt:vector></TitlesOfParts></Properties>'''
    with zipfile.ZipFile(OUTPUT, "w") as archive:
        write_entry(archive, "[Content_Types].xml", content_types)
        write_entry(archive, "_rels/.rels", root_rels)
        write_entry(archive, "docProps/core.xml", core)
        write_entry(archive, "docProps/app.xml", app)
        write_entry(archive, "xl/workbook.xml", workbook)
        write_entry(archive, "xl/_rels/workbook.xml.rels", workbook_rels)
        write_entry(archive, "xl/styles.xml", styles_xml())
        for index, (_, rows) in enumerate(sheets, start=1):
            write_entry(archive, f"xl/worksheets/sheet{index}.xml", sheet_xml(rows))


def main() -> None:
    data = load_rules()
    if data["version"] != "0.6.4":
        raise SystemExit(f"Expected v0.6.4, got {data['version']}")
    sheets = build_sheets(data)
    write_workbook(sheets)
    print(f"Wrote {OUTPUT} ({len(sheets)} sheets)")


if __name__ == "__main__":
    main()
