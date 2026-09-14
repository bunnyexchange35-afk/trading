/** Markets list — live `/api/markets` data only. No invented symbols or prices. */

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Search, TrendingDown, TrendingUp } from 'lucide-react';
import { getMarkets, type MarketQuote } from '../../api';
import { useAsync } from '../../hooks/useAsync';
import { Button, Card, EmptyState, Skeleton, Tabs } from '../../components/ui';
import { compactNumber, price, signedPercent } from '../../utils/format';

type SortKey = 'rank' | 'price' | 'change' | 'volume';
type Filter = 'all' | 'gainers' | 'losers';

export default function MarketsPage() {
  const markets = useAsync(() => getMarkets().then((r) => r.data), [], { intervalMs: 30_000 });
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('rank');
  const [filter, setFilter] = useState<Filter>('all');

  const rows = useMemo(() => {
    const all = markets.data ?? [];
    const q = query.trim().toUpperCase();
    let list = q
      ? all.filter((m) => m.symbol.toUpperCase().includes(q) || m.name.toUpperCase().includes(q))
      : all;

    if (filter === 'gainers') list = list.filter((m) => m.change > 0);
    if (filter === 'losers') list = list.filter((m) => m.change < 0);

    const sorted = [...list];
    sorted.sort((a, b) => {
      switch (sort) {
        case 'price':
          return b.price - a.price;
        case 'change':
          return b.change - a.change;
        case 'volume':
          return b.volume - a.volume;
        default:
          return (a.rank ?? 999) - (b.rank ?? 999) || a.symbol.localeCompare(b.symbol);
      }
    });
    return sorted;
  }, [markets.data, query, sort, filter]);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <span className="eyebrow">Markets</span>
          <h1 className="page-title" style={{ marginTop: 6 }}>
            Live markets
          </h1>
          <p className="page-sub">
            {markets.data ? `${markets.data.length} markets` : 'Loading markets'} · prices refresh
            automatically every 30 seconds
          </p>
        </div>
        <Link to="/trade">
          <Button variant="primary">
            Open trade desk <ArrowUpRight size={15} />
          </Button>
        </Link>
      </header>

      <div className="row" style={{ marginBottom: 'var(--sp-4)' }}>
        <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: 360 }}>
          <Search
            size={15}
            style={{ position: 'absolute', left: 12, top: 13, color: 'var(--text-faint)' }}
            aria-hidden="true"
          />
          <input
            className="input"
            style={{ paddingLeft: 34 }}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search symbol or name"
            aria-label="Search markets"
          />
        </div>

        <Tabs<Filter>
          label="Filter markets"
          value={filter}
          onChange={setFilter}
          tabs={[
            { id: 'all', label: 'All' },
            { id: 'gainers', label: 'Gainers' },
            { id: 'losers', label: 'Losers' },
          ]}
        />

        <Tabs<SortKey>
          label="Sort markets"
          value={sort}
          onChange={setSort}
          tabs={[
            { id: 'rank', label: 'Default' },
            { id: 'change', label: '24h change' },
            { id: 'price', label: 'Price' },
            { id: 'volume', label: 'Volume' },
          ]}
        />
      </div>

      <Card pad={false}>
        {markets.error && (
          <div style={{ padding: 'var(--sp-5)' }}>
            <EmptyState
              icon={<TrendingDown size={20} />}
              title="Market data unavailable"
              body={markets.error.message}
              action={
                <Button variant="outline" size="sm" onClick={markets.refresh}>
                  Try again
                </Button>
              }
            />
          </div>
        )}

        {markets.loading && !markets.data && (
          <div style={{ padding: 'var(--sp-5)' }}>
            <Skeleton className="sk-block" style={{ height: 320 }} />
          </div>
        )}

        {!markets.error && rows.length === 0 && markets.data && (
          <EmptyState
            icon={<Search size={20} />}
            title="No markets match"
            body={`Nothing found for “${query}”. Try a different symbol.`}
          />
        )}

        {rows.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Market</th>
                  <th className="table-numeric">Price</th>
                  <th className="table-numeric">24h</th>
                  <th className="table-numeric">24h high</th>
                  <th className="table-numeric">24h low</th>
                  <th className="table-numeric">Volume</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((m: MarketQuote, index) => (
                  <tr key={m.symbol}>
                    <td className="faint mono">{m.rank ?? index + 1}</td>
                    <td>
                      <Link to={`/markets/${m.symbol}`} className="row-tight" style={{ fontWeight: 600 }}>
                        <span
                          aria-hidden="true"
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: '50%',
                            display: 'grid',
                            placeItems: 'center',
                            background: m.soft || 'var(--surface-raised)',
                            color: m.color || 'var(--text-secondary)',
                            fontWeight: 700,
                            fontSize: 12,
                            flex: 'none',
                          }}
                        >
                          {m.mark || m.symbol[0]}
                        </span>
                        <span>
                          {m.symbol}
                          <span className="faint xs" style={{ marginLeft: 6, fontWeight: 400 }}>
                            {m.name}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="table-numeric mono">${price(m.price)}</td>
                    <td className={`table-numeric mono ${m.change >= 0 ? 'up' : 'down'}`}>
                      <span className="row-tight" style={{ justifyContent: 'flex-end' }}>
                        {m.change >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                        {signedPercent(m.change)}
                      </span>
                    </td>
                    <td className="table-numeric mono muted">${price(m.high)}</td>
                    <td className="table-numeric mono muted">${price(m.low)}</td>
                    <td className="table-numeric mono muted">{compactNumber(m.volume)}</td>
                    <td className="table-numeric">
                      <Link to={`/trade/${m.symbol}`}>
                        <Button variant="ghost" size="sm">
                          Trade
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
